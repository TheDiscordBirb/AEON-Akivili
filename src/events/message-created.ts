import {
    ActionRowBuilder,
    AttachmentBuilder,
    BaseGuildTextChannel,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client,
    Colors,
    DMChannel,
    EmbedBuilder,
    GuildMember,
    Message,
    MessageType,
    OmitPartialGroupDMChannel,
    PermissionFlagsBits,
    Sticker,
    User,
} from "discord.js";
import { Event } from "../structures/event";
import axios from "axios";
import { ulid } from "ulid";
import { config } from "../const";
import { Logger } from "../logger";
import { clients } from "../structures/client";
import { CustomId, DmMessageButtonArg, EmojiReplacementData, NotificationType } from "../types/event";
import { BroadcastRecord, MessagesRecord } from "../types/database";
import { metrics } from "../structures/metrics";
import { TimeSpanMetricLabel } from "../types/metrics";
import { NetworkJoinOptions } from "../types/command";
import { networkChannelPingNotificationEmbedBuilder } from "../utils/ping";
import { watermarkSize,userActivityLevelCheck } from "../utils/misc";
import { deleteEmojis, replaceEmojis } from "../utils/emoji";
import { isStaff } from "../utils/permissions"
import isApng from "is-apng";
import * as apng from 'sharp-apng';
import * as sharp from 'sharp';
import { Files } from '../types/message-created';
import { crowdControl } from "../functions/crowd-control";
import { modmailHandler } from "../functions/modmail";
import { cacheManager } from "../structures/memcache";
import { FilterOutput } from "../types/message-filter";
import { messageFilter } from "../functions/message-filter";
import { notificationManager } from "../functions/notification";
import { errorHandler } from "../structures/error-handler";
import { ErrorNames, InteractionTypes } from "../types/error-handler";
import { databaseManager } from "../structures/database";


const logger = new Logger('MessageCreated');

// TODO: rework, test
const messageCreatedEvent = async (
    client: Client,
    interaction: Message<boolean>,
    interactionMember: GuildMember,
    channelWebhookBroadcast: BroadcastRecord,
    broadcastRecords: BroadcastRecord[],
): Promise<void> => {
    const webhookChannelType = channelWebhookBroadcast.channelType;
    const {accepted: files, rejected: rejectedFiles} = await convertStickersAndImagesToFiles(interaction);
    const emojiReplacement = await replaceEmojis(interaction.content, client);

    await interaction.delete();
    let cc = false;
    if(webhookChannelType === NetworkJoinOptions.GENERAL) {
        cc = await crowdControl.crowdControl(interaction, interactionMember, emojiReplacement);
        if(cc) return;
    }
    
    const sentMessage = await createWebhookMessages(
        client,
        broadcastRecords, 
        webhookChannelType, 
        interaction, 
        interactionMember, 
        files, 
        rejectedFiles, 
        emojiReplacement
    );
    
    if(!sentMessage) return;

    if (sentMessage.notify) {
        await sendNotification(client, interaction, interactionMember, sentMessage?.MessagesRecord);
    }

    if (emojiReplacement.emojis.length) {
        await deleteEmojis(emojiReplacement);
    }
}

export const dmMessageChecks = async (interaction: OmitPartialGroupDMChannel<Message<boolean>>) => {
    if(
        interaction.author == interaction.client.user 
        || config.activeBanshareFuncionUserIds.includes(interaction.author.id)
    ) return;
    await dmMessageEvent(interaction);
}

export const guildMessageChecks = async (interaction: OmitPartialGroupDMChannel<Message<boolean>>) => {
    if (interaction.webhookId) return;

    const webhook = config.activeWebhooks.find((webhook) => webhook.channelId === interaction.channelId);
    if(!webhook) return;
    
    const guildId = interaction.guildId;
    if(!guildId) throw new Error(ErrorNames.NO_GUILD);

    const client = clients.find((client) => client.guilds.cache.has(guildId));
    if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_SERVER);

    const interactionMember = interaction.member;
    if (!interactionMember) throw new Error(ErrorNames.NO_USER);
    if (interactionMember.user.id === client.user?.id) return;
    if (await databaseManager.hasUserBeenMutedOnNetworkChat(interactionMember.user.id)) throw new Error(ErrorNames.USER_IS_MUTED);
    
    const channel = interaction.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);
    
    const broadcastRecords = await databaseManager.getBroadcasts();
    const channelWebhookBroadcast = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
    if (!channelWebhookBroadcast) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK);

    const interactionType = interaction.type;
    if (interactionType === MessageType.ChannelPinnedMessage) return;

    const webhookBroadcast = await databaseManager.getBroadcastByWebhookId(webhook.id);
    if (!webhookBroadcast) throw new Error(ErrorNames.NO_BROADCAST_IN_DB);
    
    if (config.nonChatWebhooksTypes.includes(webhookBroadcast.channelType)) {
        if (webhookBroadcast.channelType === NetworkJoinOptions.INFO) {
            await interaction.delete();
        }
        throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);
    }

    const filterOutput = await filterHandling(interaction);
    if(!filterOutput.resultClean) {
        await interaction.delete();
        throw new Error(ErrorNames.MESSAGE_FILTER);
    }

    await messageCreatedEvent(
        client,
        interaction,
        interactionMember,
        channelWebhookBroadcast,
        broadcastRecords
    );
}

export default new Event("messageCreate", async (interaction) => {
    if(config.botStarting) return;
    const metricId = metrics.start(TimeSpanMetricLabel.MESSAGE_CREATED);
    try {
        const channelType = interaction.channel.type;
        switch(channelType) {
            case ChannelType.DM:
                await dmMessageChecks(interaction);
                break;
            default:
                await guildMessageChecks(interaction);
                break;
        }
    } catch (e) {
        await errorHandler.showError({
            error: e as Error,
            user: interaction.author, 
            interactionType: InteractionTypes.MESSAGE_CREATED
        });
        logger.error(`Got error during message-created event.`, e as Error, interaction.client.user.id);

    }
    metrics.stop(metricId);
});

export const dmMessageEvent = async (interaction: OmitPartialGroupDMChannel<Message<boolean>>) => {
    const modmail = await databaseManager.getModmailByUserId(interaction.author.id);
    if(!modmail) {
        await dmMessageResponse(interaction.client,interaction);
        return;
    }
    await modmailHandler.forwardModmailMessage(interaction);
}

const convertStickersAndImagesToFiles = async (interaction: Message<boolean>): Promise<Files> => {
    const files: AttachmentBuilder[] = [];
    const rejectedFiles: string[] = [];
    const broadcasts = await databaseManager.getBroadcasts();
    const broadcastGuildIds: string[] = [];
    broadcasts.forEach((broadcast) => {
        return broadcastGuildIds.push(broadcast.guildId);
    })
    
    const downloadedStickers = (await Promise.allSettled(interaction.stickers.map(async (interactionSticker) => {
        let stickerBuffer;
        let sticker: Sticker;
        try {
            sticker = await interactionSticker.fetch();
        } catch(e) {
            logger.warn(`Could not get sticker.`);
            rejectedFiles.push(interactionSticker.name);
            return undefined;
        }
        const cachedSticker = await cacheManager.retrieveCache('sticker', sticker.id);
        if(cachedSticker) {
            return new AttachmentBuilder(cachedSticker, { name: `${sticker.name}${isApng(cachedSticker) ? ".gif" : ".png"}` });
        }
        // This if statement ensures that out of network and disabled server stickers cant be used by Akivili
        if (sticker.guildId && broadcastGuildIds.includes(sticker.guildId) 
            && !config.disabledStickerNetworkServerIds.includes(sticker.guildId)) {
            if (config.enableStickers) {
                stickerBuffer = await axios.get(sticker.url, { responseType: 'arraybuffer' })
            } else {
                rejectedFiles.push(interactionSticker.name);
                return undefined;
            }
        } else {
            rejectedFiles.push(interactionSticker.name);
            return undefined;
        }

        let watermarkText = sticker.guild?.name;
        if(!watermarkText){
            rejectedFiles.push(interactionSticker.name);
            return undefined;
        }
        watermarkText = watermarkText
            .replaceAll("&", "&amp;")
            .replaceAll(/</g, "&lt;")
            .replaceAll(/>/g, "&gt;")
            .replaceAll(/"/g, "&quot;");
        const isGif = isApng(Buffer.from(stickerBuffer.data, 'utf-8'));
        let sharpAttachment;
        if (isGif) {
            const image = await apng.sharpFromApng(Buffer.from(stickerBuffer.data, 'utf-8'), { transparent: true, format: "rgba4444" });
            const attachment = await (image as sharp.Sharp).toBuffer()
            sharpAttachment = sharp.default(attachment, {animated: true});
        } else {
            const attachment = Buffer.from(stickerBuffer.data)
            sharpAttachment = sharp.default(attachment);
        }
        const metadata = await sharpAttachment.metadata();
        let pages = metadata.pages ?? 1;
        const watermark = `
        <svg width="${metadata.width}" height="${metadata.height! / pages}" opacity="0.5">
            <text
            x="50%"
            y="50%"
            dominant-baseline="middle"
            text-anchor="middle"
            transform="rotate(${Math.atan((metadata.height! / pages) / metadata.width!)*180/Math.PI} ${metadata.width! / 2} ${(metadata.height! / pages) / 2})"
            style="fill:#FFFFFF;paint-order:stroke;stroke:#000000;font-style:normal;font-size:${await watermarkSize(metadata, watermarkText)}px;font-family:'Source Code Pro'">${watermarkText}</text>
            <text
            x="50%"
            y="${((metadata.height! / pages) / 2) + (await watermarkSize(metadata, watermarkText)*1.3)}"
            dominant-baseline="middle"
            text-anchor="middle"
            transform="rotate(${Math.atan((metadata.height! / pages) / metadata.width!)*180/Math.PI} ${metadata.width! / 2} ${(metadata.height! / pages) / 2})"
            style="fill:#FFFFFF;paint-order:stroke;stroke:#000000;font-style:normal;font-size:${await watermarkSize(metadata, watermarkText)}px;font-family:'Source Code Pro'">${sticker.name}</text>
        </svg>
        `;
        const watermarkBuffer = Buffer.from(watermark);
        const watermarked = sharpAttachment.composite([{input: watermarkBuffer, gravity: 'northeast', 'tile': true}]);
        let watermarkedStickerBuffer: Buffer<ArrayBufferLike>;
        try {
            watermarkedStickerBuffer = await (watermarked as sharp.Sharp).toBuffer();
        } catch(error) {
            logger.warn(`Could not put watermark on sticker.`);
            rejectedFiles.push(interactionSticker.name);
            return undefined;
        }
        await cacheManager.saveCache('sticker', sticker.id, watermarkedStickerBuffer as Buffer<ArrayBuffer>)

        const attachBuffer = new AttachmentBuilder(watermarkedStickerBuffer, { name: `${sticker.name}${isGif ? ".gif" : ".png"}` });
        
        return attachBuffer;
    }))).reduce<AttachmentBuilder[]>((acc, item) => {
        if (item.status !== 'fulfilled') {
            logger.warn(`Could not create downloaded sticker. Status: ${item.status}`)
            return acc;
        }
        if (!item.value) return acc;
        acc.push(item.value);
        return acc;
    }, []);
    
    const downloadedAttachments = (await Promise.allSettled(interaction.attachments.map(async (interactionAttachment) => {
        const attachmentBuffer = await axios.get(interactionAttachment.url, { responseType: 'arraybuffer' });
        const attachment = new AttachmentBuilder(Buffer.from(attachmentBuffer.data), { name: interactionAttachment.name });
        return attachment;
    }))).reduce<AttachmentBuilder[]>((acc, item) => {
        if (item.status !== 'fulfilled') {
            logger.warn(`Could not create downloaded attachment. Status: ${item.status}`)
            return acc;
        }
        acc.push(item.value);
        return acc;
    }, []);

    files.push(...downloadedAttachments, ...downloadedStickers);
    return {accepted: files, rejected: rejectedFiles};
}

const dmMessageResponse = async (client: Client, interaction: Message<boolean>): Promise<void> => {
    const dmResponseEmbed = new EmbedBuilder()
        .setTitle("Dm message received")
        .setDescription("Please select one of the following:")
        .setColor(Colors.DarkGold)

    const dmResponseActionRow = new ActionRowBuilder<ButtonBuilder>();

    const broadcasts = await databaseManager.getBroadcasts();
    const userInfo = Object.values(broadcasts).reduce<{ guildMember?: GuildMember, userIsModerator: boolean }>((acc, broadcast) => {
        const guild = client.guilds.cache.get(broadcast.guildId);
        if (!guild) return acc;
        if (acc.userIsModerator) return acc;
        const guildMember = guild.members.cache.find((user) => user.id === interaction.author.id);
        if (!guildMember) return acc;
        if (guildMember.permissions.has(PermissionFlagsBits.BanMembers)) {
            return {guildMember, userIsModerator: true};
        }
        return { guildMember, userIsModerator: false };
    }, {guildMember: undefined, userIsModerator: false});

    const modmailButton = new ButtonBuilder()
        .setCustomId(`${DmMessageButtonArg.OPEN_MODMAIL} ${interaction.author.id} ${interaction.id}`)
        .setLabel("Modmail")
        .setStyle(ButtonStyle.Secondary)
    const banshareButton = new ButtonBuilder()
        .setCustomId(`${DmMessageButtonArg.NEW_BANSHARE} ${userInfo.guildMember?.guild.id}`)
        .setLabel("Banshare")
        .setStyle(ButtonStyle.Secondary)

    dmResponseActionRow.addComponents(modmailButton);
    if(userInfo.guildMember && userInfo.userIsModerator) {
        dmResponseActionRow.addComponents(banshareButton);
    }
    await (interaction.channel as DMChannel).send({embeds: [dmResponseEmbed], components: [dmResponseActionRow]});
}

const createWebhookMessages = async (
    client: Client,
    broadcastRecords: BroadcastRecord[],
    webhookChannelType: string,
    interaction: Message<boolean>,
    interactionMember: GuildMember,
    files: AttachmentBuilder[],
    rejectedFiles: string[],
    emojiReplacement: EmojiReplacementData
): Promise<{ MessagesRecord: MessagesRecord, notify: boolean } | undefined> => {
    if (rejectedFiles.length) throw new Error(ErrorNames.DID_NOT_GET_STICKER);
    
    if (!interaction.guild) throw new Error(ErrorNames.NO_GUILD);

    let nameSuffix = `|| ${interaction.guild.name}`;
    let genRole = false;

    if (isStaff.dev(interactionMember.user) && !genRole) {
        nameSuffix = `「 Akivili Dev 」` + nameSuffix;
        genRole = true;
    }
    if (isStaff.conductor(interactionMember.user) && !genRole) {
        nameSuffix = ` 「 Conductor 」` + nameSuffix;
        genRole = true;
    }
    if (isStaff.navigator(interactionMember.user) && !genRole) {
        nameSuffix = ` 「 Navigator 」` + nameSuffix;
        genRole = true;
    }

    let activityIcon = "";
    const userActivityLevel = await userActivityLevelCheck(interactionMember.id);
    switch (userActivityLevel) {
        case 1:
            activityIcon = "💵";
            break;
        case 2:
            activityIcon = "💎";
            break;
        case 3:
            activityIcon = "👑";
            break;
        default:
            break;
    }
    nameSuffix = `${activityIcon ? ` ${activityIcon}` : ""}${nameSuffix}`;
    
    const matchingBroadcastRecords = broadcastRecords.filter((broadcastRecord) => broadcastRecord.channelType === webhookChannelType);
    const webhookMessages = await Promise.all(matchingBroadcastRecords.map(async (broadcastRecord) => {
        let sendOptions;
        if (!interaction.guild) {
            await Promise.reject(ErrorNames.NO_GUILD);
            return;
        }
    
        if (interaction.reference) {
            const replyButtonRow = new ActionRowBuilder<ButtonBuilder>();
            if (!interaction.reference.messageId) {
                await Promise.reject(ErrorNames.NO_REFERENCE_MESSAGE);
                return;
            }
            const referenceMessage = interaction.channel.messages.cache.get(interaction.reference.messageId);
            if (!referenceMessage) {
                await Promise.reject(ErrorNames.NO_REFERENCE_MESSAGE);
                return;
            }

            let referencedMessages
            try {
                referencedMessages = await databaseManager.getMessages(referenceMessage.channelId, referenceMessage.id);
            } catch(e) {
                await Promise.reject(ErrorNames.NO_MESSAGE);
                return;
            }

            const referencedMessageOnChannel = referencedMessages.find(
                (referencedMessage) => referencedMessage.channelId === broadcastRecord.channelId);
            
            if (referencedMessageOnChannel) {
                const replyArrowEmoji = client.emojis.cache.find((emoji) => emoji.id === config.replyArrowEmojiId);
                if (!replyArrowEmoji) {
                    await Promise.reject(ErrorNames.NO_REPLY_ARROW_EMOJI);
                    return;
                }

                let originalMessage = referencedMessages.find((referencedMessage) => referencedMessage.messageOrigin);
                if (!originalMessage) {
                    await Promise.reject(ErrorNames.NO_MESSAGE);
                    return;
                }

                const replyButtonUser = new ButtonBuilder()
                    .setLabel(originalMessage.username)
                    .setDisabled(true)
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId(CustomId.REPLY)
                    .setEmoji(replyArrowEmoji.identifier)
                
                let referenceMessageContent = referenceMessage.content;
                const referenceMessageTooLong = referenceMessageContent.length > 25;
                
                    
                const replyButtonLink = new ButtonBuilder()
                    .setURL(`https://discord.com/channels/${referencedMessageOnChannel?.guildId}/${referencedMessageOnChannel?.channelId}/${referencedMessageOnChannel.channelMessageId}`)
                    .setStyle(ButtonStyle.Link);
                
                let replyButtonText = referenceMessageContent.slice(0, 25);
                if(replyButtonText.includes("||")) {
                    replyButtonText = "[This message contains spoilers]";
                }

                if (referenceMessageContent) {
                    replyButtonLink.setLabel(`${replyButtonText}${(referenceMessageTooLong && replyButtonText != "[This message contains spoilers]")? '...' : ''}`)
                }
                if (!!referenceMessage.attachments.size || !referenceMessageContent) {
                    const replyPictureEmoji = client.emojis.cache.find((emoji) => emoji.id === config.replyPictureEmojiId);
                    if (!replyPictureEmoji) {
                        await Promise.reject(ErrorNames.NO_REPLY_PICTURE_EMOJI);
                        return;
                    }
                    replyButtonLink.setEmoji(replyPictureEmoji.identifier);
                }
                        
                replyButtonRow.addComponents(replyButtonUser, replyButtonLink);
    
                if (interactionMember.user.bot) {
                    sendOptions = {
                        components: [replyButtonRow, ...interaction.components],
                        embeds: interaction.embeds,
                    }
                } else {
                    sendOptions = {
                        components: [replyButtonRow],
                    };
                }
            } else {
                const replyButtonUser = new ButtonBuilder()
                    .setLabel("Can't load reply")
                    .setDisabled(true)
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId(CustomId.REPLY)
                        
                replyButtonRow.addComponents(replyButtonUser);
    
                if (interactionMember.user.bot) {
                    sendOptions = {
                        components: [replyButtonRow, ...interaction.components],
                        embeds: interaction.embeds,
                    }
                } else {
                    sendOptions = {
                        components: [replyButtonRow],
                    };
                }
            }
        } else {
            if (interactionMember.user.bot) {
                sendOptions = {
                    components: interaction.components,
                    embeds: interaction.embeds,
                };
            }
        }

        const webhook = config.activeWebhooks.find((webhook) => webhook.id === broadcastRecord.webhookId);
        if(!webhook) {
            await Promise.reject(ErrorNames.DID_NOT_FIND_WEBHOOK_IN_CACHE);
            return;
        }

        let avatarURL = (interactionMember.avatarURL() ? interactionMember.avatarURL() : interactionMember.displayAvatarURL()) ?? undefined;
        let username = `${interactionMember.nickname ? interactionMember.nickname : interactionMember.displayName}`;
        username = username
            .replaceAll("💵", "")
            .replaceAll("💎", "")
            .replaceAll("👑", "")
            .replaceAll("「 Conductor 」", "")
            .replaceAll("「 Akivili Dev 」", "")
            .replaceAll("「 Navigator 」", "")
            + (genRole ? "" : " ")
            + nameSuffix;
        
        return {
            webhook,
            messageData: {
                avatarURL,
                content: emojiReplacement.content,
                files,
                username,
                allowedMentions: { parse: [] },
                ...sendOptions,
            },
            guildId: broadcastRecord.guildId,
            userId: interactionMember.user.id,
        }
    }))
    .catch(async (reason) => {
        await errorHandler.showError({
            error: reason,
            user: interaction.author,
            interactionType: InteractionTypes.MESSAGE_CREATED 
        })
        logger.error(reason, new Error(reason));
        return undefined;
    });
    if(!webhookMessages) return;


    const uid = ulid();
    let sentMessage: { MessagesRecord: MessagesRecord, notify: boolean } | undefined;
    await Promise.all(webhookMessages.map(async (webhookMessage) => {
        if (!webhookMessage) throw new Error(ErrorNames.DID_NOT_SEND_MESSAGE);

        const messageOrigin = webhookMessage.guildId === interaction.guildId;
        let message;
        for(const client of clients) {
            const broadcast = await databaseManager.getBroadcastByWebhookId(webhookMessage.webhook.id);
            if(!broadcast) {
                await Promise.reject(ErrorNames.NO_BROADCAST_IN_DB);
                return;
            }
            if(broadcast.serviceClientId === client.user?.id) {
                const webhook = await client.fetchWebhook(broadcast.webhookId);
                message = await webhook.send(webhookMessage.messageData);
            }
        }

        if (!message) {
            await Promise.reject(ErrorNames.NO_MESSAGE);
            return;
        }
        
        const messageData = {
            channelId: message.channelId,
            channelMessageId: message.id,
            guildId: webhookMessage.guildId,
            timestamp: interaction.createdAt.getTime(),
            userId: webhookMessage.userId,
            uniqueMessageId: uid,
            username: interaction.guild?.members.cache.find((member) => member.id === interaction.author.id)?.nickname ?? interaction.author.displayName,
            messageOrigin
        }

        await databaseManager.logMessage(messageData);
        if (messageOrigin) {
            sentMessage = { MessagesRecord: messageData, notify: (interaction.reference || interaction.mentions.members?.size) ? true : false};
        }
    }))
    .catch(async (reason) => {
        await errorHandler.showError({
            error: reason,
            user: interaction.author,
            interactionType: InteractionTypes.MESSAGE_CREATED 
        })
        logger.error(reason, new Error(reason));
        return undefined;
    })
    return sentMessage;
}

const sendNotification = async (client: Client, interaction: Message<boolean>, interactionMember: GuildMember, sentMessage?: MessagesRecord): Promise<void> => {
    let uniqueInteractionMentions = [...new Set(interaction.mentions.users)];
    if (interaction.reference) {
        if (!interaction.reference.messageId) throw new Error(ErrorNames.NO_REFERENCE_MESSAGE);
        let referencedMessages: MessagesRecord[];
        try {
            referencedMessages = await databaseManager.getMessages(interaction.reference.channelId, interaction.reference.messageId);
        } catch (error) {
            throw new Error(ErrorNames.NO_MESSAGE_IN_DB);
        }
        const referenceMessage = referencedMessages.find((rMessage) => rMessage.channelMessageId === interaction.reference?.messageId);
        if (!referenceMessage) throw new Error(ErrorNames.MESSAGE_DOES_NOT_EXIST);
        if (!interaction.reference.guildId) throw new Error(ErrorNames.NO_GUILD);
        const pingedUser = client.users.cache.get(referenceMessage.userId);
        if (!pingedUser) throw new Error(ErrorNames.NO_USER);
        const pingMessageContent = await networkChannelPingNotificationEmbedBuilder(pingedUser.id, interaction, sentMessage, interactionMember.user, referenceMessage);
        if (pingMessageContent) {
            if (!pingedUser.dmChannel) {
                await pingedUser.createDM();
            }
            await pingedUser.send({ embeds: [pingMessageContent.EmbedBuilder], files: pingMessageContent.Attachments });
    
            uniqueInteractionMentions = uniqueInteractionMentions.filter(value => pingedUser.id !== value[0]);
        }
    }

    if (interaction.mentions.users) {
        uniqueInteractionMentions.forEach(async (pingedUser) => {
            if (client.users.cache.has(pingedUser[0])) {
                let pingMessageContent;
                try {
                    pingMessageContent = await networkChannelPingNotificationEmbedBuilder(pingedUser[0], interaction, sentMessage, interactionMember.user);
                } catch (error) {
                    throw new Error()
                }
                if (pingMessageContent) {
                    if (!pingedUser[1].dmChannel) {
                        await pingedUser[1].createDM();
                    }
                    await pingedUser[1].send({ embeds: [pingMessageContent.EmbedBuilder], files: pingMessageContent.Attachments });
                }
            }
        })
    }
}

const filterHandling = async (message: Message<boolean>): Promise<FilterOutput> => {
    const result = await messageFilter.filterMessage(message.content.toLowerCase());
    if(!message.guild) throw new Error(ErrorNames.NO_GUILD);
    if(!result.resultClean) {
        await notificationManager.sendNotification({
            executingUser: message.author, 
            notificationType: NotificationType.FILTERED_MESSAGE, 
            filteredWords: result.detectedFilteredContent, 
            guild: message.guild, 
            time: Date.now()
        });
    }
    return result;
}
