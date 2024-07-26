import { Logger } from "../logger"
import { Event } from "../structures/event";
import { BaseGuildTextChannel, ChannelType } from "discord.js";
import { databaseManager } from "../structures/database";
import { config } from "../const";

const logger = new Logger("reactionCreated");

export default new Event("messageReactionAdd", async (interaction, user) => {
    // temporary check so people can actually react while im debugging this
    if (user.id != "464417492060733440") return;
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

    await interaction.message.reactions.removeAll();

    logger.debug(`Components length: ${interaction.message.components.length}`);
    if (interaction.message.components.length > 0) {
        if (interaction.message.components[0].components[0].customId == ".") {

        }
        logger.debug(`First component's first component's custom id: ${interaction.message.components[0].components[0].customId}`)
    }
})