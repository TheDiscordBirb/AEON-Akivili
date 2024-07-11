import { TextChannel } from "discord.js";
import { client } from "../structures/client";
import { databaseManager } from "../structures/database";
import { Event } from "../structures/event";
import { Logger } from "../logger";

const logger = new Logger("MessageDeleted");

export default new Event("messageDelete", async (interaction) => {
    if (!interaction.webhookId) return;
    const referencedMessages = await databaseManager.getMessages(interaction.channelId, interaction.id, true);
    const webhookMessages = await Promise.allSettled(referencedMessages.map(async (referencedMessage) => {
        const channel = client.channels.cache.get(referencedMessage.channelId);
        if (!channel) {
            logger.warn('Could not find channel while trying to delete message.');
            return undefined;
        }
        await (channel as TextChannel).messages.fetch();
        const message = (channel as TextChannel).messages.cache.get(referencedMessage.channelMessageId);
        
        if (!message) {
            return undefined;
        }
    
        try {
            await message.delete();
        } catch (error) {
            logger.error('Could not delete message.', error as Error);
        }
    }));
});