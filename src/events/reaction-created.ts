import { Logger } from "../logger"
import { Event } from "../structures/event";
import {
    ActionRow,
    BaseGuildTextChannel,
    ChannelType,
    Message,
    MessageActionRowComponent
} from "discord.js";
import { databaseManager } from "../structures/database";
import { config } from "../const";
import { deleteEmojis, rebuildMessageComponentAfterUserInteraction, replaceEmojis } from "../utils";
import { MessagesRecord } from "../types/database";
import { client } from "../structures/client";
import { EmojiReplacementData } from "../types/event";

const logger = new Logger("ReactionCreated");

export default new Event("messageReactionAdd", async (interaction, user) => {
    if (user.bot) return;
    
    const channel = interaction.message.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) return;
    
    const broadcastRecords = await databaseManager.getBroadcasts();
    const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
    if (!channelWebhook) return;

    const webhooks = config.activeWebhooks;
    const guildWebhooks = webhooks.filter((webhook) => webhook.guildId === interaction.message.guildId);
    if(!guildWebhooks) {
        return;
    }
    const webhook = guildWebhooks.find((channelWebhook) => channelWebhook.name.includes("Aeon"));
    if (!webhook) {
        return;
    }
    const webhookBroadcast = await databaseManager.getBroadcastByWebhookId(webhook.id);
    if (!webhookBroadcast) {
        logger.warn(`Could not get webhook broadcast`);
        return
    }
    
    if (config.nonChatWebhooks.includes(webhook.name)) return;
    
    const webhookChannelType = channelWebhook.channelType;

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
    const newActionRows = await rebuildMessageComponentAfterUserInteraction(interaction.message as Message<boolean>, actionRows as ActionRow<MessageActionRowComponent>[], { userId: user.id, userMessageId: messageUidInDb, reactionIdentifier: interaction.emoji.identifier });
    let messageContent = interaction.message.content;
    let emojiReplacement : EmojiReplacementData | undefined;
    if(messageContent) {
        emojiReplacement = await replaceEmojis(messageContent, client);
    }

    await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
        if (!interaction.emoji.identifier) return;
        const webhook = webhooks.find((webhook) => webhook.id === broadcastRecord.webhookId);
        if(!webhook) {
            logger.warn(`Could not find webhook ${broadcastRecord.webhookId}`);
            return;
        }
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
        
        const webhookMessage = await webhook.fetchMessage(correctMessageOnNetwork.channelMessageId);
        await webhook.editMessage(webhookMessage.id, { content: emojiReplacement?.content, components: [...newActionRows[newActionRows.indexOf(newActionRows.find((actionRow) => actionRow.guildID === broadcastRecord.guildId) || newActionRows[0])].components] });
        return;
    }))
    deleteEmojis(emojiReplacement);
})