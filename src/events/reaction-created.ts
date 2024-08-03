import { Logger } from "../logger"
import { Event } from "../structures/event";
import { BaseGuildTextChannel, ChannelType, User, WebhookClient } from "discord.js";
import { databaseManager } from "../structures/database";
import { config } from "../const";
import { rebuildMessageComponentAfterUserInteraction } from "../utils";
import { notificationManager } from "../functions/notification";
import { NotificationType } from "../types/event";
import { MessagesRecord } from "../structures/types";

const logger = new Logger("ReactionCreated");

export default new Event("messageReactionAdd", async (interaction, user) => {
    if (user.bot) return;
    
    const channel = interaction.message.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) return;
    
    const broadcastRecords = await databaseManager.getBroadcasts();
    const broadcastWebhookIds = broadcastRecords.map((broadcast) => broadcast.webhookId);
    
    let webhooks;
    try {
        webhooks = await channel.fetchWebhooks();
    } catch (error) { 
        logger.warn(`Could not fetch webhooks at message-create. Error: ${(error as Error).message}`)
        return;
    };
    
    const webhook = webhooks.find((webhook) => broadcastWebhookIds.includes(webhook.id));
    
    if (!webhook) return;
    if (config.nonChatWebhooks.includes(webhook.name)) return;
    
    const webhookNameParts = webhook.name.split(' ');
    const webhookChannelType = webhookNameParts[webhookNameParts.length - 1];

    await interaction.message.reactions.removeAll();
    
    const actionRows = interaction.message.components;

    const matchingBroadcastRecords = broadcastRecords.filter((broadcastRecord) => broadcastRecord.channelType === webhookChannelType);
    let messageUidInDb: string;
    try {
        messageUidInDb = await databaseManager.getMessageUid(interaction.message.channelId, interaction.message.id);
    } catch (error) {
        logger.error(`Could not get messages. Error: `, error as Error);
        return;
    }
    const newActionRows = await rebuildMessageComponentAfterUserInteraction(actionRows, { userId: user.id, userMessageId: messageUidInDb, reactionIdentifier: interaction.emoji.identifier });

    await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
        if (!interaction.emoji.identifier) return;
        const webhookClient = new WebhookClient({ id: broadcastRecord.webhookId, token: broadcastRecord.webhookToken });
        let messagesOnNetwork: MessagesRecord[];
        try {
            messagesOnNetwork = await databaseManager.getMessages(interaction.message.channel.id, interaction.message.id);
        } catch (error) {
            logger.error(`Could not get messages. Error: `, error as Error);
            return;
        }
        const correctMessageOnNetwork = messagesOnNetwork.find((messageOnNetwork) => messageOnNetwork.channelId === broadcastRecord.channelId);
        if (!correctMessageOnNetwork) {
            return;
        }
        
        const webhookMessage = await webhookClient.fetchMessage(correctMessageOnNetwork.channelMessageId);
        await webhookClient.editMessage(webhookMessage.id, { components: [...newActionRows] });
        return;
    }))
})