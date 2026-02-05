import { BaseGuildTextChannel, ChannelType, GuildTextBasedChannel } from "discord.js";
import { Event } from "../structures/event";
import { hasModerationRights } from "../utils";
import { Logger } from "../logger";
import { databaseManager } from "../structures/database";
import { client } from "../structures/client";
import { config } from "../const";
import { NetworkJoinOptions } from "../types/command";
const logger = new Logger(`PinEvent`);

export default new Event("messageUpdate", async (oldMessage, newMessage) => {
    if(config.botStarting) return;
    if (!newMessage) return;
    if (!newMessage.guild) return;
    if (!newMessage.channel) return;
    const channel = newMessage.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) return;
    if (!newMessage.id) return;
    const message = channel.messages.cache.get(newMessage.id);
    if (!message) return;

    const broadcastRecords = await databaseManager.getBroadcasts();
    if (!broadcastRecords.find((broadcastRecord) => broadcastRecord.channelId === newMessage.channel.id)) return;
    
    const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
    if (!channelWebhook) return;
    
    let webhook;
    try {
        webhook = await client.fetchWebhook(channelWebhook.webhookId);
    } catch (error) { 
        logger.error(`Could not fetch webhook in guild: ${newMessage.guild?.name ?? 'Unknown'} channel: ${channel.name ?? 'Unknown'}`, error as Error)
        return;
    };
    
    if (config.nonChatWebhooks.includes(webhook.name)) return;
    if (message.type !== 6) return;
    const messageUid = await databaseManager.getMessageUid(message.channel.id, message.id);
    const relatedMessageRecords = (await databaseManager.getMessages(newMessage.channel.id, newMessage.id)).filter((relatedMessageRecord) => relatedMessageRecord.userMessageId === messageUid);
    
    await Promise.allSettled(relatedMessageRecords.map(async (relatedMessageRecord) => {
        const guild = client.guilds.cache.get(relatedMessageRecord.guildId);
        if (!guild) {
            // TODO: write log
            return;
        }
        const channel = guild.channels.cache.get(relatedMessageRecord.channelId);
        if (!channel) {
            // TODO: write log
            return;
        }
        const message = (channel as GuildTextBasedChannel).messages.cache.get(relatedMessageRecord.channelMessageId);
        if (!message) {
            // TODO: write log
            return;
        }
        
        if (!oldMessage.pinned && newMessage.pinned) {
            try {
                await message.pin();
            } catch (error) {
                logger.error(`Couldnt pin message`, (error as Error));
            }
        }
        if (oldMessage.pinned && !newMessage.pinned) {
            try {
                await message.unpin();
            } catch (error) {
                logger.error(`Couldnt unpin message`, (error as Error));
            }
        }
    }))

});