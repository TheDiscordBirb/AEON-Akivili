import { GuildTextBasedChannel, Collection, Webhook, WebhookType } from "discord.js";
import { client } from "../structures/client";
import { Event } from "../structures/event";
import { Logger } from '../logger';
import { databaseManager } from "../structures/database";
import { config } from "../const";
import { experimentalPatchWarning, statusUpdate } from "../utils";
import cron from 'node-cron';

const logger = new Logger('Ready');

export default new Event("clientReady", async () => {
    logger.info(`${client.user?.username} is online`);
    const guilds = await client.guilds.fetch();
    const broadcasts = await databaseManager.getBroadcasts();
    const chatBroadcasts = broadcasts.filter((broadcast) => !config.nonChatWebhooksTypes.includes(broadcast.channelType));
    const otherBroadcasts = broadcasts.filter((broadcast) => config.nonChatWebhooksTypes.includes(broadcast.channelType));
    let guildCount = 0;
    logger.info('Loading guilds...');
    for await (const oauthGuild of guilds) {
        const guild = client.guilds.cache.get(oauthGuild[0]);
        if (!guild) continue;
        let webhooks: Collection<string, Webhook<WebhookType.Incoming | WebhookType.ChannelFollower>>;
        await Promise.all([
            await guild.members.fetch(),
            webhooks = await guild.fetchWebhooks(),
        ]);
        webhooks = webhooks.filter((webhook) => webhook.owner?.id === client.user?.id);
        const guildBroadcasts = chatBroadcasts.filter((broadcast) => broadcast.guildId === guild.id);
        if (!guildBroadcasts.length) continue;
        guildCount++;
        let networkServer = false;
        logger.info(`Trying to load guild "${guild.name}" (id: ${guild.id})`);
        webhooks.map(async (webhook) => {
            try {
                if(!webhook.owner || !client.user) {
                    logger.warn(`Could not load (${webhook.sourceGuild?.name} | ${webhook.channel?.name}) webhook.`);
                    return;
                }
                if(webhook.owner.id !== client.user.id) return;
                const broadcast = await databaseManager.getBroadcastByWebhookId(webhook.id);
                if(!broadcast) {
                    logger.warn(`Could not get broadcast for webhook ${webhook.id}`);
                    return;
                }
                config.activeWebhooks.push(webhook);
                if(config.nonChatWebhooksTypes.includes(broadcast.channelType)) return;
                if(!networkServer) {                
                    logger.info(`Loaded guild "${guild.name}" (id: ${guild.id}).`);
                    logger.info(`Fetched ${webhooks.size} webhooks and ${guild.memberCount} members.`);
                }
                networkServer = true;
                const aeonChannel = await guild.channels.fetch(webhook.channelId);
                if(!aeonChannel) return;
                const timeStart = Date.now();
                const loadedMessages = await (aeonChannel as GuildTextBasedChannel).messages.fetch({ limit: config.numberOfMessagesToLoad });
                logger.info(`Fetched the last ${loadedMessages.size} messages from ${aeonChannel.name} in ${Date.now() - timeStart}ms`);
            }
            catch (error) {
                logger.error(`There was an error fetching messages: `, error as Error);
            }
        })
        if(config.cleanDbMode) {
            if(guildBroadcasts.length) {
                guildBroadcasts.forEach(async (broadcast) => {
                    if(!webhooks.find((webhook) => webhook.id === broadcast.webhookId)) {
                        logger.warn(`Deleted Aeon ${broadcast.channelType} (id: ${broadcast.webhookId}) from guild with id ${broadcast.guildId}, because it had no reference.`)
                        await databaseManager.deleteBroadcastByWebhookId(broadcast.webhookId);
                    }
                })
            }
        }
    }

    logger.info(`Loaded ${guildCount} guild${guildCount === 1 ? '' : 's'}`);

    
    await statusUpdate(guilds);
    cron.schedule('*/5 * * * *', async () => {
        await statusUpdate(guilds);
    });

    await experimentalPatchWarning();
    cron.schedule('0 */2 * * *', async () => {
        await experimentalPatchWarning();
    })
});