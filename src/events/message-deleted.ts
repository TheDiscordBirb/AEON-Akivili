import { TextChannel, Message, User } from "discord.js";
import { client } from "../structures/client";
import { databaseManager } from "../structures/database";
import { Event } from "../structures/event";
import { Logger } from "../logger";
import { MessagesRecord } from "../types/database";
import { notificationManager } from "../functions/notification";
import { NotificationType } from "../types/event";

const logger = new Logger("MessageDeleted");

export default new Event("messageDelete", async (interaction) => {
    if (!interaction.webhookId) return;
    if (!interaction.guild) return;

    let referencedMessages: MessagesRecord[];
    try {
        referencedMessages = await databaseManager.getMessages(interaction.channelId, interaction.id, true);
    } catch (error) {
        logger.error(`Could not get messages. Error: `, error as Error);
        return;
    }
    if (!referencedMessages.length) return;

    const broadcasts = await databaseManager.getBroadcasts();
    let messageChannelType = '';
    broadcasts.forEach((broadcast) => {
        if (broadcast.channelId === referencedMessages[0].channelId) {
            messageChannelType = broadcast.channelType;
            return;
        }
    })
    
    const targetUser = client.users.cache.find((clientUser) => clientUser.id === referencedMessages[0].userId);
    let message: Message<true> | undefined;
    await Promise.allSettled(referencedMessages.map(async (referencedMessage) => {
        const channel = client.channels.cache.get(referencedMessage.channelId);
        if (!channel) {
            logger.warn('Could not find channel while trying to delete message.');
            return undefined;
        }
        await (channel as TextChannel).messages.fetch();
        message = (channel as TextChannel).messages.cache.get(referencedMessage.channelMessageId);
        
        if (!message) {
            return undefined;
        }
        try {
            await message.delete();
        } catch (error) {
            logger.error('Could not delete message.', error as Error);
        }
    }));
    await notificationManager.sendNotification({
        executingUser: targetUser as User,
        targetUser: targetUser,
        channelType: messageChannelType,
        message: interaction as Message,
        notificationType: NotificationType.MESSAGE_DELETE,
        time: Date.now(),
        guild: interaction.guild,
        deletedByMod: true
    })
});