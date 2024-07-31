import { AttachmentBuilder, BaseGuildTextChannel, Collection, WebhookClient, WebhookType, Webhook, Snowflake, APIMessage, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Emoji, BaseGuildEmoji, ComponentEmojiResolvable, EmojiResolvable } from "discord.js";
import { Event } from "../structures/event";
import axios from "axios";
import { databaseManager } from '../structures/database';
import { ulid } from "ulid";
import { config } from "../const";
import { Logger } from "../logger";
import { client } from "../structures/client";
import { asyncRetry } from "../utils";
import { CustomId } from "../types/event";
import interactionReady from "./interaction-ready";

const logger = new Logger('MessageCreated');

export default new Event("messageCreate", async (interaction) => {
    if (interaction.webhookId) return;
    if (interaction.member?.user.id === client.user?.id) return;
    
    const channel = interaction.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) return;
    
    let webhooks;
    try {
        webhooks = await channel.fetchWebhooks();
    } catch (error) { 
        logger.error(`Could not fetch webhooks in guild: ${interaction.guild?.name ?? 'Unknown'} channel: ${channel.name ?? 'Unknown'}`, error as Error)
        return;
    };
    
    const broadcastRecords = await databaseManager.getBroadcasts();
    const broadcastWebhookIds = broadcastRecords.map((broadcast) => broadcast.webhookId);
    const webhook = webhooks.find((webhook) => broadcastWebhookIds.includes(webhook.id));
    
    if (!webhook) return;
    if (config.nonChatWebhooks.includes(webhook.name)) return;
    
    const webhookNameParts = webhook.name.split(' ');
    const webhookChannelType = webhookNameParts[webhookNameParts.length - 1];
    
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

    interaction.delete();
    
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
                // TODO: write log
                return;
            }
            const referenceMessage = interaction.channel.messages.cache.get(interactionReference.messageId);
            if (!referenceMessage) {
                // TODO: write log
                return;
            }
            const referencedMessages = await databaseManager.getMessages(referenceMessage.channelId, referenceMessage.id);
            const referencedMessageOnChannel = referencedMessages.find((referencedMessage) => referencedMessage.channelId === broadcastRecord.channelId);
            
            if (referencedMessageOnChannel) {
                const replyArrowEmoji = client.emojis.cache.find((emoji) => emoji.id === config.replyArrowEmojiId);
                if (!replyArrowEmoji) {
                    // TODO: write log
                    return;
                }

                const replyButtonUser = new ButtonBuilder()
                    .setLabel(referenceMessage.author.displayName)
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
                        // TODO: write log
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
                username: `${interaction.member.nickname ? interaction.member.nickname : interaction.member.displayName} | ${interaction.guild.name}`,
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
            })
        } catch (error) {
            logger.warn('Could not send message, deleting broadcast record.');
            await databaseManager.deleteBroadcastByWebhookId(webhookMessage.webhookClient.id);
        }
    }));
});