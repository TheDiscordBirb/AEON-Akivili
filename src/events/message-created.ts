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
    GuildMember
} from "discord.js";
import { Event } from "../structures/event";
import axios from "axios";
import { databaseManager } from '../structures/database';
import { ulid } from "ulid";
import { config } from "../const";
import { Logger } from "../logger";
import { client } from "../structures/client";
import { CustomId, EmojiReplacementData } from "../types/event";
import { BroadcastRecord, MessagesRecord } from "../types/database";
import { metrics } from "../structures/metrics";
import { TimeSpanMetricLabel } from "../types/metrics";
import { NetworkJoinOptions } from "../types/command";
import { isConductor, isDev, isNavigator, networkChannelPingNotificationEmbedBuilder, replaceEmojis, userActivityLevelCheck } from "../utils";
import isApng from "is-apng";
import * as apng from 'sharp-apng';
import * as sharp from 'sharp';
import { InteractionData } from '../types/meassage-created';


const logger = new Logger('MessageCreated');

const messageCreatedEvent = async (interaction: Message<boolean>): Promise<void> => {
    try {
        const { interactionMember, channelWebhook, broadcastRecords } = await getInteractionData(interaction);
        const webhookChannelType = channelWebhook.channelType;
        const files = await convertStickersAndImagesToFiles(interaction);
        const emojiReplacement = await replaceEmojis(interaction.content, client);

        await interaction.delete();

        const sentMessage = await createWebhookMessages(broadcastRecords, webhookChannelType, interaction, interactionMember, files, emojiReplacement);
        await sendNotification(interaction, interactionMember, sentMessage);
        deleteEmojis(emojiReplacement);
    } catch {
        return;
    }
}

export default new Event("messageCreate", async (interaction) => {
    const metricId = metrics.start(TimeSpanMetricLabel.MESSAGE_CREATED);
    try {
        await messageCreatedEvent(interaction);
    } catch (error) {
        logger.warn('Could not execute create message event', error as Error);
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
        
    const downloadedStickers = (await Promise.allSettled(interaction.stickers.map(async (interactionSticker) => {
        const stickerBuffer = await axios.get(interactionSticker.url, { responseType: 'arraybuffer' });
	let server;
	if (interactionSticker.guild) {
                server = interactionSticker.guild.name;
	} else {
		server = 'A.E.O.N. ⟡ Towards the Stars';
	}
	let isGif;
        let sharpAttachment;
        if (isApng(Buffer.from(stickerBuffer.data, 'utf-8'))) {
            const image = await apng.sharpFromApng(Buffer.from(stickerBuffer.data, 'utf-8'), { transparent: true, format: "rgba4444" });
	    isGif = true;
	    const attachment = await (image as sharp.Sharp).toBuffer()
            sharpAttachment = await sharp.default(attachment, {animated: true});
        } else {
            const attachment = Buffer.from(stickerBuffer.data)
            sharpAttachment = await sharp.default(attachment);
	}
        const metadata = await sharpAttachment.metadata();
	// GIF
	let pages;
	if (metadata.pages) {
	        pages = metadata.pages
	} else {
	        pages = 1
	}
        const watermark = `
        <svg width="${metadata.width}" height="${metadata.height! / pages}" opacity="0.5">
              <text
               x="50%"
               y="50%"
               dominant-baseline="middle"
               text-anchor="middle"
               transform="rotate(45 ${metadata.width! / 2} ${(metadata.height! / pages) / 2})"
               style="fill:#FFFFFF;paint-order:stroke;stroke:#000000;font-style:normal;font-size:${((metadata.width! / 2) * ((metadata.height! / pages) / 2)) / 2500}px;font-family:'Source Code Pro'">${server}</text>
               </svg>
              `;
        const watermarkBuffer = Buffer.from(watermark);
        const watermarked = await sharpAttachment.composite([{input: watermarkBuffer, gravity: 'northeast', 'tile': true}]);
	let attachBuffer;
	if (isGif) {
            attachBuffer = new AttachmentBuilder(await (watermarked as sharp.Sharp).toBuffer(), { name: `${interactionSticker.name}.gif` });
	} else {
            attachBuffer = new AttachmentBuilder(await (watermarked as sharp.Sharp).toBuffer(), { name: `${interactionSticker.name}.png` });
	}
        return attachBuffer;
    }))).reduce<AttachmentBuilder[]>((acc, item) => {
        if (item.status !== 'fulfilled') {
            logger.warn(`Could not create downloaded sticker. Status: ${item.status}`)
            return acc;
        }
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

const createWebhookMessages = async (
    broadcastRecords: BroadcastRecord[],
    webhookChannelType: string,
    interaction: Message<boolean>,
    interactionMember: GuildMember,
    files: AttachmentBuilder[],
    emojiReplacement: EmojiReplacementData): Promise<MessagesRecord | undefined> => {
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
                
                if (referenceMessageContent) {
                    replyButtonLink.setLabel(`${referenceMessage.content.slice(0, 25)}${referenceMessageTooLong ? '...' : ''}`)
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


    let sentMessage: MessagesRecord | undefined = undefined;
    const uid = ulid();
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
                sentMessage = messageData;
            }
        } catch (error) {
            if ((error as Error).message.includes("Username cannot contain")) {
                if (!interaction.author.dmChannel) {
                    await interaction.author.createDM(true);
                }
                interaction.author.send(`You have a prohibited word in your nickname, please change it, or your message will not be sent.
                    ${(error as Error).message.split("username")[(error as Error).message.split("username").length - 1]}`);
                return;
            }
            logger.error('Could not send message', error as Error);
        }
    }));
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
                const pingMessageContent = await networkChannelPingNotificationEmbedBuilder(pingedUser[0], interaction, sentMessage, interactionMember.user);
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
