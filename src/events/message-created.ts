import { AttachmentBuilder, BaseGuildTextChannel, WebhookClient, APIMessage, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { Event } from "../structures/event";
import axios from "axios";
import { databaseManager } from '../structures/database';
import { ulid } from "ulid";
import { config } from "../const";
import { Logger } from "../logger";
import { client } from "../structures/client";

const logger = new Logger('MessageCreated');

export default new Event("messageCreate", async (interaction) => {
    if (interaction.webhookId) return;
    if (interaction.member?.user === client.user) return;
    
    const channel = interaction.channel as BaseGuildTextChannel;
    
    
    const broadcastRecords = await databaseManager.getBroadcasts();
    const broadcastWebhookIds = broadcastRecords.map((broadcast) => broadcast.webhookId);
    const webhooks = await channel.fetchWebhooks();
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
            
            if (!referencedMessageOnChannel) {
                logger.warn('Could not find referenced message on channel.');
                return undefined;
            }

            const replyButtonUser = new ButtonBuilder()
                .setLabel(referenceMessage.author.displayName)
                .setDisabled(true)
                .setStyle(ButtonStyle.Primary)
                .setCustomId('Teapot')
                
            const replyButtonLink = new ButtonBuilder()
                .setURL(`https://discord.com/channels/${referencedMessageOnChannel?.guildId}/${referencedMessageOnChannel?.channelId}/${referencedMessageOnChannel.userMessageId}`)
                .setLabel(referenceMessage.content)
                .setStyle(ButtonStyle.Link);
                    
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
                avatarURL: interaction.member.user.displayAvatarURL() ?? undefined,
                content: interaction.content,
                files: files,
                username: `${interaction.member.user.displayName} | ${interaction.guild.name}`,
                ...sendOptions,
            },
            guildId: broadcastRecord.guildId,
            userId: interaction.member.user.id,
        };
    }));

    await Promise.allSettled(webhookMessages.map(async (webhookMessagePromiseResult) => {
        if (webhookMessagePromiseResult.status !== 'fulfilled') {
            logger.warn(`Could not create webhook message. Status: ${webhookMessagePromiseResult.status}`)
            return;
        }
        const webhookMessage = webhookMessagePromiseResult.value;
        if (!webhookMessage) {
            logger.warn(`Received empty webhook message. Status: ${webhookMessagePromiseResult.status}`)
            return;
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