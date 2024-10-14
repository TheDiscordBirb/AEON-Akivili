import {
    AttachmentBuilder,
    BaseGuildTextChannel,
    WebhookClient,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Message,
    GuildEmoji,
    ClientUser,
    User,
    APIMessage
} from "discord.js";
import { Event } from "../structures/event";
import axios from "axios";
import { databaseManager } from '../structures/database';
import { ulid } from "ulid";
import { config } from "../const";
import { Logger } from "../logger";
import { client } from "../structures/client";
import { CustomId } from "../types/event";
import { MessagesRecord } from "../types/database";
import { metrics } from "../structures/metrics";
import { TimeSpanMetricLabel } from "../types/metrics";
import { NetworkJoinOptions } from "../types/command";
import { isConductor, isDev, isNavigator, isUserActive, networkChannelPingNotificationEmbedBuilder, replaceEmojis } from "../utils";
import isApng from "is-apng";
import * as apng from 'sharp-apng';
import * as sharp from 'sharp';


const logger = new Logger('MessageCreated');

const messageCreatedEvent = async (interaction: Message<boolean>): Promise<void> => {
    logger.debug("Got here");
    if (interaction.webhookId) return;
    const interactionMember = interaction.member;
    if (!interactionMember) return;
    if (interactionMember.user.id === client.user?.id) return;
    if (await databaseManager.hasUserBeenMutedOnNetworkChat(interactionMember.user.id)) return;
    
    const channel = interaction.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) return;
    
    const broadcastRecords = await databaseManager.getBroadcasts();
    const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
    if (!channelWebhook) return;
    if (interaction.type === 6) return;

    let webhook;
    try {
        webhook = await client.fetchWebhook(channelWebhook.webhookId);
    } catch (error) {
        logger.error(`Could not fetch webhook in guild: ${interaction.guild?.name ?? 'Unknown'} channel: ${channel.name ?? 'Unknown'}`, error as Error)
        return;
    };
    
    if (config.nonChatWebhooks.includes(webhook.name)) {
        if (webhook.name === `Aeon ${NetworkJoinOptions.INFO}`) {
            await interaction.delete();
        }
        return;
    }
    logger.debug("Got here");
    
    const webhookChannelType = channelWebhook.channelType;
    
    const files: AttachmentBuilder[] = [];
    
    const downloadedStickers = (await Promise.allSettled(interaction.stickers.map(async (interactionSticker) => {
        const stickerBuffer = await axios.get(interactionSticker.url, { responseType: 'arraybuffer' });
        let attachment;
        if (isApng(Buffer.from(stickerBuffer.data, 'utf-8'))) {
            const image = await apng.sharpFromApng(Buffer.from(stickerBuffer.data, 'utf-8'), { transparent: true, format: "rgba4444" });
            attachment = new AttachmentBuilder(await (image as sharp.Sharp).toBuffer(), { name: `${interactionSticker.name}.gif` });
        } else {
            attachment = new AttachmentBuilder(Buffer.from(stickerBuffer.data), { name: `${interactionSticker.name}.png` });
        }
        return attachment;
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

    const emojiReplacement = await replaceEmojis(interaction.content, client);
    logger.debug("Got here");
    await interaction.delete();
    
    const matchingBroadcastRecords = broadcastRecords.filter((broadcastRecord) => broadcastRecord.channelType === webhookChannelType);
    const uid = ulid();
    const webhookMessages = await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
        const webhookClient = new WebhookClient({ id: broadcastRecord.webhookId, token: broadcastRecord.webhookToken });
        
        let sendOptions;
        if (!interaction.guild) {
            return undefined;
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
/*
        if (await isUserActive(interactionMember.id)) {
            nameSuffix = ` 💎` + nameSuffix;
        }
*/
        let avatarURL = (interactionMember.avatarURL() ? interactionMember.avatarURL() : interactionMember.displayAvatarURL()) ?? undefined;
        let username = `${interactionMember.nickname ? interactionMember.nickname : interactionMember.displayName}` + nameSuffix;
        const customProfile = await databaseManager.getCustomProfile(interactionMember.id);
        if (customProfile) {
            avatarURL = customProfile.avatarUrl;
            username = `${customProfile.name}` + nameSuffix;
        }
        
        return {
            webhookClient,
            messageData: {
                avatarURL,
                content: emojiReplacement.content,
                files: files,
                username,
                allowedMentions: { parse: [] },
                ...sendOptions,
            },
            guildId: broadcastRecord.guildId,
            userId: interactionMember.user.id,
        };
    }));

    let sentMessage: MessagesRecord | undefined = undefined;
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
        const sentReferenceMessage = (client.guilds.cache.get(interaction.reference.guildId)?.channels.cache.get(interaction.reference.channelId) as BaseGuildTextChannel).messages.cache.get(interaction.reference.messageId);
        const pingedUser = client.users.cache.get(referenceMessage.userId);
        if (!pingedUser) {
            // TODO: write log   
            return;
        }
        const pingMessageContent = await networkChannelPingNotificationEmbedBuilder(pingedUser.id, interaction, sentMessage, interactionMember.user, referenceMessage);
        if (!pingedUser.dmChannel) {
            await pingedUser.createDM();
        }
        await pingedUser.send({ embeds: [pingMessageContent.EmbedBuilder], files: pingMessageContent.Attachments });

        uniqueInteractionMentions = uniqueInteractionMentions.filter(value => pingedUser.id !== value[0]);
    }

    if (interaction.mentions.users) {
        uniqueInteractionMentions.forEach(async (pingedUser) => {
            if (client.users.cache.has(pingedUser[0])) {
                const pingMessageContent = await networkChannelPingNotificationEmbedBuilder(pingedUser[0], interaction, sentMessage, interactionMember.user);
                if (!pingedUser[1].dmChannel) {
                    await pingedUser[1].createDM();
                }
                await pingedUser[1].send({ embeds: [pingMessageContent.EmbedBuilder], files: pingMessageContent.Attachments });
            }
        })
    }
    
    emojiReplacement.emojis.forEach(async (emoji) => {
        const guildEmoji = client.emojis.cache.get(emoji.id)
        if (!guildEmoji) return;
        await guildEmoji.guild.emojis.delete(emoji);
    })

    
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