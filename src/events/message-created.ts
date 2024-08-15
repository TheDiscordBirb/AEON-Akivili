import {
    AttachmentBuilder,
    BaseGuildTextChannel,
    WebhookClient,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Message
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

const logger = new Logger('MessageCreated');

const messageCreatedEvent = async (interaction: Message<boolean>): Promise<void> => {
    if (interaction.webhookId) return;
    if (!interaction.member) return;
    if (interaction.member.user.id === client.user?.id) return;
    if (await databaseManager.hasUserBeenMutedOnNetworkChat(interaction.member.user.id)) return;
    
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
    
    const webhookChannelType = channelWebhook.channelType;
    
    const files: AttachmentBuilder[] = [];
    
    const downloadedStickers = (await Promise.allSettled(interaction.stickers.map(async (interactionSticker) => {
        const stickerBuffer = await axios.get(interactionSticker.url, { responseType: 'arraybuffer' });
        const attachment = new AttachmentBuilder(Buffer.from(stickerBuffer.data, 'utf-8'), { name: `${interactionSticker.name}.png`});
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

    await interaction.delete();
    
    const matchingBroadcastRecords = broadcastRecords.filter((broadcastRecord) => broadcastRecord.channelType === webhookChannelType);
    const uid = ulid();
    const webhookMessages = await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
        const webhookClient = new WebhookClient({ id: broadcastRecord.webhookId, token: broadcastRecord.webhookToken });
        
        let sendOptions;
        if (!interaction.member) {
            return undefined;
        }
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
    
                if (interaction.member.user.bot) {
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
    
                if (interaction.member.user.bot) {
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
            if (interaction.member.user.bot) {
                sendOptions = { 
                    components: interaction.components,
                    embeds: interaction.embeds,
                };
            }
        }
        
        return {
            webhookClient,
            messageData: {
                avatarURL: (interaction.member.avatarURL() ? interaction.member.avatarURL() : interaction.member.displayAvatarURL()) ?? undefined,
                content: interaction.content,
                files: files,
                username: `${interaction.member.nickname ? interaction.member.nickname : interaction.member.displayName} || ${interaction.guild.name}`,
                allowedMentions: {parse: []},
                ...sendOptions,
            },
            guildId: broadcastRecord.guildId,
            userId: interaction.member.user.id,
        };
    }));

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
            await databaseManager.logMessage({
                channelId: message.channel_id,
                channelMessageId: message.id,
                guildId: webhookMessage.guildId,
                timestamp: interaction.createdAt.getTime(),
                userId: webhookMessage.userId,
                userMessageId: uid,
                userName: interaction.guild?.members.cache.find((member) => member.id === interaction.author.id)?.nickname ?? interaction.author.displayName,
                messageOrigin: messageOrigin
            })
        } catch (error) {
            if ((error as Error).message.includes("Username cannot contain")) {
                if (!interaction.author.dmChannel) {
                    await interaction.author.createDM(true);
                }
                interaction.author.send(`You have a prohibited word in your nickname, please change it, or your message will not be sent.
                    ${(error as Error).message.split("username")[(error as Error).message.split("username").length - 1]}`);
                return;
            }
            logger.error('Could not send message, deleting broadcast record.', error as Error);
            // await databaseManager.deleteBroadcastByWebhookId(webhookMessage.webhookClient.id);
        }
    }));
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