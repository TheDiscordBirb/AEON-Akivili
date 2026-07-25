import { TextChannel, Message, User } from "discord.js";
import { clients } from "../structures/client";
import { databaseManager } from "../structures/database";
import { Event } from "../structures/event";
import { Logger } from "../logger";
import { notificationManager } from "../functions/notification";
import { NotificationType } from "../types/event";
import { config } from "../const";
import { ErrorNames } from "../types/error-handler";

const logger = new Logger("MessageDeleted");

// TODO: rework, test
export default new Event("messageDelete", async (interaction) => {
    if(config.botStarting) return;
    if (!interaction.webhookId) return;
    if (!interaction.guild) return;
    const guildId = interaction.guildId;
    if(!guildId) return;
    const client = clients.find((client) => client.guilds.cache.has(guildId));
    if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_SERVER);
    
    const broadcasts = await databaseManager.getBroadcasts();

    let messageChannelType = '';
    await Promise.allSettled(broadcasts.map((broadcast) => {
        if (broadcast.channelId === referencedMessages[0].channelId) {
            messageChannelType = broadcast.channelType;
            return;
        }
    }));
    if(!messageChannelType) throw new Error(ErrorNames.NO_BROADCAST_IN_DB);

    const referencedMessages = await databaseManager.getMessages(interaction.channelId, interaction.id);
    if (!referencedMessages.length) throw new Error(ErrorNames.NO_MESSAGE_IN_DB);
    
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
    await databaseManager.deleteMessages(referencedMessages[0].channelMessageId);
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