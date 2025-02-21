import {
    AttachmentBuilder,
    BaseGuildTextChannel,
    WebhookClient,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Message,
    MessageType,
    GuildMember,
    EmbedBuilder,
    Colors,
    DMChannel
} from "discord.js";
import { Event } from "../structures/event";
import axios from "axios";
import { databaseManager } from '../structures/database';
import { cacheManager } from '../structures/memcache';
import { ulid } from "ulid";
import { config } from "../const";
import { Logger } from "../logger";
import { client } from "../structures/client";
import { CustomId, DmMessageButtonArg, EmojiReplacementData } from "../types/event";
import { BroadcastRecord, MessagesRecord } from "../types/database";
import { metrics } from "../structures/metrics";
import { TimeSpanMetricLabel } from "../types/metrics";
import { NetworkJoinOptions } from "../types/command";
import {
    hasModerationRights,
    isConductor,
    isDev,
    isNavigator,
    networkChannelPingNotificationEmbedBuilder,
    replaceEmojis,
    userActivityLevelCheck,
    watermarkSize
} from "../utils";
import isApng from "is-apng";
import * as apng from 'sharp-apng';
import * as sharp from 'sharp';
import { InteractionData } from '../types/message-created';
import { crowdControl } from "../functions/crowd-control";
import { modmailHandler } from "../functions/modmail";


const logger = new Logger('MessageCreated');

const messageCreatedEvent = async (interaction: Message<boolean>): Promise<void> => {
    try {
        try {
            await databaseManager.getModmail(interaction.channelId);
            return;
        } catch(error) {
        }
        const { interactionMember, channelWebhook, broadcastRecords } = await getInteractionData(interaction);
        const webhookChannelType = channelWebhook.channelType;
        const files = await convertStickersAndImagesToFiles(interaction);
        const emojiReplacement = await replaceEmojis(interaction.content, client);

        await interaction.delete();
        let sentMessage;
        let cc = false;
        if(webhookChannelType === NetworkJoinOptions.GENERAL) {
            cc = await crowdControl.crowdControl(webhookChannelType, interaction, interactionMember, emojiReplacement);
        }
        if(!cc) {
            sentMessage = await createWebhookMessages(broadcastRecords, webhookChannelType, interaction, interactionMember, files, emojiReplacement);
        } else {
            return;
        }
        if (!sentMessage) {
            logger.warn("Could not send message.");
        }
        if (sentMessage?.notify) {
            await sendNotification(interaction, interactionMember, sentMessage?.MessagesRecord);
        }
        if (emojiReplacement.emojis.length) {
            deleteEmojis(emojiReplacement);
        }
    } catch (error) {
        throw new Error((error as Error).message);
    }
}

export default new Event("messageCreate", async (interaction) => {
    const metricId = metrics.start(TimeSpanMetricLabel.MESSAGE_CREATED);
    try {
        const channelType = interaction.channel.type;
        switch(channelType) {
            case ChannelType.DM:
                if(interaction.author == client.user || config.activeBanshareFuncionUserIds.includes(interaction.author.id)) return;
                let modmail;
                try {
                    modmail = await databaseManager.getModmailByUserId(interaction.author.id);
                    await modmailHandler.forwardModmailMessage(interaction);
                    return;
                } catch (error) {
                }
                await dmMessageResponse(interaction);
                break;
            default:
                await messageCreatedEvent(interaction);
                break;
        }
    } catch (error) {
        logger.warn('Could not execute create message event', error as Error);
        try {
            if (config.debugMode) {
                await interaction.member?.send(`There was an error delivering your message with ${error as Error}`);
            }
        } catch (noIntMember) {
            logger.warn(`Could not message user.`);
        }
    }
    metrics.stop(metricId);
});

const getInteractionData = async (interaction: Message<boolean> ): Promise<InteractionData> => {
    if (interaction.webhookId) throw new Error('No webhook id for interaction.');
    const interactionMember = interaction.member;
    if (!interactionMember) throw new Error('No interaction member defined.');
    if (interactionMember.user.id === client.user?.id) throw new Error('Could not determine user id.') ;
    if (await databaseManager.hasUserBeenMutedOnNetworkChat(interactionMember.user.id)) {
        await interaction.delete();
        throw new Error('User is muted.');
    };
    
    const channel = interaction.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) throw new Error('Channel type is not guild text.');
    
    const broadcastRecords = await databaseManager.getBroadcasts();
    const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
    if (!channelWebhook) throw new Error('No channel could be found in broadcasts for webhook.');
    const interactionType = interaction.type;
    if (interactionType === MessageType.ChannelPinnedMessage) throw new Error('Got pinned message message.');

    let webhook;
    try {
        webhook = await client.fetchWebhook(channelWebhook.webhookId);
    } catch (error) {
        logger.error(`Could not fetch webhook in guild: ${interaction.guild?.name ?? 'Unknown'} channel: ${channel.name ?? 'Unknown'}`, error as Error)
        throw new Error(`Could not fetch webhook in guild: ${interaction.guild?.name ?? 'Unknown'} channel: ${channel.name ?? 'Unknown'}`)
    };
    
    if (config.nonChatWebhooks.includes(webhook.name)) {
        if (webhook.name === `Aeon ${NetworkJoinOptions.INFO}`) {
            await interaction.delete();
        }
        throw new Error('Webhook name does not start with Aeon.');
    }

    return {
        interactionMember,
        broadcastRecords,
        channelWebhook  
    }
}
const convertStickersAndImagesToFiles = async (interaction: Message<boolean>): Promise<AttachmentBuilder[]> => {
    const files: AttachmentBuilder[] = [];
    const broadcasts = await databaseManager.getBroadcasts();
    const broadcastGuildIds: string[] = [];
    broadcasts.forEach((broadcast) => {
        return broadcastGuildIds.push(broadcast.guildId);
    })
    
    const downloadedStickers = (await Promise.allSettled(interaction.stickers.map(async (interactionSticker) => {
        let stickerBuffer;
        // This code snipet ensures that out of network stickers cant be used by Akivili
        const sticker = await interactionSticker.fetch();

        let bufferSticker = await cacheManager.retrieveCache('sticker', sticker.id)
        if (bufferSticker !== false) {
            const attachBuffer = new AttachmentBuilder(bufferSticker, { name: `${sticker.name}${isApng(bufferSticker) ? ".gif" : ".png"}` });
        
            return attachBuffer;
        }

        if (sticker.guildId && broadcastGuildIds.includes(sticker.guildId) && !config.disabledStickerNetworkServerIds.includes(sticker.guildId)) {
            if (config.enableStickers) {
                stickerBuffer = await axios.get(sticker.url, { responseType: 'arraybuffer' })
            } else {
                return undefined;
            }
        } else {
            return undefined;
        }

        let watermarkText = sticker.guild?.name;
        if(!watermarkText){
            return undefined;
        }
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
        console.log(await watermarkSize(metadata, watermarkText));
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
        await cacheManager.saveCache('sticker',sticker.id ,await (watermarked as sharp.Sharp).toBuffer())

        const attachBuffer = new AttachmentBuilder(await (watermarked as sharp.Sharp).toBuffer(), { name: `${sticker.name}${isGif ? ".gif" : ".png"}` });
        
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
    return files;
}

const dmMessageResponse = async (interaction: Message<boolean>): Promise<void> => {
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
        if (hasModerationRights(guildMember)) {
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
    broadcastRecords: BroadcastRecord[],
    webhookChannelType: string,
    interaction: Message<boolean>,
    interactionMember: GuildMember,
    files: AttachmentBuilder[],
    emojiReplacement: EmojiReplacementData): Promise<{ MessagesRecord: MessagesRecord, notify: boolean } | undefined> => {
    // This checks if a message had stickers that didn't get converted and notifies the user
    if (interaction.stickers.size && !files.length) {
        if (!interaction.member) {
            await interaction.reply({ content: "Sorry, this sticker is not in the AEON Network or the server asked us to not use their stickers, as such it can not be used here." });
        }
        await interaction.member?.send({ content: "Sorry, this sticker is not in the AEON Network or the server asked us to not use their stickers, as such it can not be used here." });
        return;
    }
    
    if (!interaction.guild) return undefined;
    let nameSuffix = ` || ${interaction.guild.name}`;
    if (isNavigator(interactionMember.user)) {
        nameSuffix = ` | Navigator`;
    }
    if (isConductor(interactionMember.user)) {
        nameSuffix = ` | Conductor`;
    }
    if (isDev(interactionMember.user)) {
        nameSuffix = ` | Akivili Dev`;
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
    const webhookMessages = await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
        let sendOptions;
        if (!interaction.guild) {
            return Promise.reject();
        }
    
        if (interaction.reference) {
            const replyButtonRow = new ActionRowBuilder<ButtonBuilder>();
            const interactionReference = interaction.reference;
            if (!interactionReference.messageId) {
                logger.warn(`Could not get interaction reference message id`);
                return;
            }
            const referenceMessage = interaction.channel.messages.cache.get(interactionReference.messageId);
            if (!referenceMessage) {
                logger.warn(`Could not get reference message`);
                return;
            }
            let referencedMessages: MessagesRecord[];
            try {
                referencedMessages = await databaseManager.getMessages(referenceMessage.channelId, referenceMessage.id);
            } catch (error) {
                logger.error(`Could not get messages. Error: `, error as Error);
                return;
            }
            const referencedMessageOnChannel = referencedMessages.find((referencedMessage) => referencedMessage.channelId === broadcastRecord.channelId);
            
            if (referencedMessageOnChannel) {
                const replyArrowEmoji = client.emojis.cache.find((emoji) => emoji.id === config.replyArrowEmojiId);
                if (!replyArrowEmoji) {
                    logger.warn(`Could not get reply arrow emoji`);
                    return;
                }

                let labelName = referencedMessages.find((referencedMessage) => referencedMessage.messageOrigin)?.userName;
                if (!labelName) {
                    labelName = referenceMessage.author.displayName.split("||")[0];
                }
                const referencedUserId = referencedMessageOnChannel.userId;
                const referencedUserCustomProfile = await databaseManager.getCustomProfile(referencedUserId);
                if (referencedUserCustomProfile) {
                    labelName = referencedUserCustomProfile.name;
                }

                const replyButtonUser = new ButtonBuilder()
                    .setLabel(labelName)
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
                    replyButtonText = "[This message contains spoliers]";
                }

                if (referenceMessageContent) {
                    replyButtonLink.setLabel(`${replyButtonText}${(referenceMessageTooLong && replyButtonText != "[This message contains spoilers]")? '...' : ''}`)
                }
                if (!!referenceMessage.attachments.size || !referenceMessageContent) {
                    const replyPictureEmoji = client.emojis.cache.find((emoji) => emoji.id === config.replyPictureEmojiId);
                    if (!replyPictureEmoji) {
                        logger.warn(`Could not gett reply picture emoji`);
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

        let avatarURL = (interactionMember.avatarURL() ? interactionMember.avatarURL() : interactionMember.displayAvatarURL()) ?? undefined;
        let username = `${interactionMember.nickname ? interactionMember.nickname : interactionMember.displayName}`;
        username = username.replaceAll("💵", "").replaceAll("💎", "").replaceAll("👑", "") + nameSuffix;
        const customProfile = await databaseManager.getCustomProfile(interactionMember.id);
        if (customProfile) {
            avatarURL = customProfile.avatarUrl;
            username = `${customProfile.name}` + nameSuffix;
        }
        
        return {
            webhookClient: new WebhookClient({ id: broadcastRecord.webhookId, token: broadcastRecord.webhookToken }),
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
    }));


    let sentMessage: { MessagesRecord: MessagesRecord, notify: boolean } | undefined = undefined;
    const uid = ulid();
    let prohibitedNick: { error: Error | undefined, nickFailed: boolean } = { error: undefined, nickFailed: false };
    await Promise.allSettled(webhookMessages.map(async (webhookMessagePromiseResult) => {
        if (webhookMessagePromiseResult.status !== 'fulfilled') {
            logger.warn(`Could not create webhook message. Status: ${webhookMessagePromiseResult.status} `)
            return;
        }
        const webhookMessage = webhookMessagePromiseResult.value;
        if (!webhookMessage) {
            logger.warn(`Received empty webhook message. Status: ${webhookMessagePromiseResult.status}, Webhook guildId: ${webhookMessagePromiseResult.value?.guildId}`)
            return undefined;
        }
        let messageOrigin = 0;
        if (webhookMessagePromiseResult.value?.guildId === interaction.guildId) {
            messageOrigin = 1;
        }
        try {
            const message = await webhookMessage.webhookClient.send(webhookMessage.messageData);
            if (!message) {
                logger.warn(`Received empty message. Status: ${webhookMessagePromiseResult.status}`)
                return;
            }
            
            const messageData = {
                channelId: message.channel_id,
                channelMessageId: message.id,
                guildId: webhookMessage.guildId,
                timestamp: interaction.createdAt.getTime(),
                userId: webhookMessage.userId,
                userMessageId: uid,
                userName: interaction.guild?.members.cache.find((member) => member.id === interaction.author.id)?.nickname ?? interaction.author.displayName,
                messageOrigin: messageOrigin
            }
            await databaseManager.logMessage(messageData);
            if (messageOrigin) {
                sentMessage = { MessagesRecord: messageData, notify: (interaction.reference || interaction.mentions.members?.size) ? true : false};
            }
        } catch (error) {
            if ((error as Error).message.includes("Username cannot contain")) {
                if (!interaction.author.dmChannel) {
                    await interaction.author.createDM(true);
                }
                prohibitedNick = { error: error as Error, nickFailed: true };
            }
            logger.error('Could not send message', error as Error);
        }
    }));
    if (prohibitedNick.nickFailed) {
        if (!prohibitedNick.error) {
            logger.warn("Got nickname error, but the error is undefined.");
            return sentMessage;
        }
        await interaction.author.send(`You have a prohibited word in your nickname, please change it, or your message will not be sent.
            ${(prohibitedNick.error).message.split("username")[(prohibitedNick.error).message.split("username").length - 1]}`);
    }
    return sentMessage;
}

const sendNotification = async (interaction: Message<boolean>, interactionMember: GuildMember, sentMessage?: MessagesRecord): Promise<void> => {
    let uniqueInteractionMentions = [...new Set(interaction.mentions.users)];
    if (interaction.reference) {
        if (!interaction.reference.messageId) {
            // TODO: write log   
            return;
        }
        let referencedMessages: MessagesRecord[];
        try {
            referencedMessages = await databaseManager.getMessages(interaction.reference.channelId, interaction.reference.messageId);
        } catch (error) {
            logger.error(`Could not get messages. Error: `, error as Error);
            return;
        }
        const referenceMessage = referencedMessages.find((rMessage) => rMessage.channelMessageId === interaction.reference?.messageId);
        if (!referenceMessage) {
            // TODO: write log   
            return;
        }
        if (!interaction.reference.guildId) {
            // TODO: write log
            return;
        }
        const pingedUser = client.users.cache.get(referenceMessage.userId);
        if (!pingedUser) {
            // TODO: write log   
            return;
        }
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
                    logger.error('An error occured while getting ping message content', (error as Error));
                    return;
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

const deleteEmojis = (emojiReplacement: EmojiReplacementData): void => {
    emojiReplacement.emojis.forEach(async (emoji) => {
        const guildEmoji = client.emojis.cache.get(emoji.id)
        if (!guildEmoji) return;
        await guildEmoji.guild.emojis.delete(emoji);
    });
}
