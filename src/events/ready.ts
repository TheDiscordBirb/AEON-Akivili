import { GuildTextBasedChannel, Collection, Webhook, WebhookType, Guild } from "discord.js";
import { client } from "../structures/client";
import { Event } from "../structures/event";
import { Logger } from '../logger';
import { databaseManager } from "../structures/database";
import { config } from "../const";
import { experimentalPatchWarning, statusUpdate } from "../utils";
import cron from 'node-cron';
import { messageFilter } from "../functions/message-filter";

const logger = new Logger('Ready');

export default new Event("clientReady", async () => {
    await messageFilter.addToFilterArray(await databaseManager.getFilteredWords());
    logger.info(`${client.user?.username} is online`);
    const guilds = await client.guilds.fetch();
    const broadcasts = await databaseManager.getBroadcasts();
    const chatBroadcasts = broadcasts.filter((broadcast) => !config.nonChatWebhooksTypes.includes(broadcast.channelType));
    const otherBroadcasts = broadcasts.filter((broadcast) => config.nonChatWebhooksTypes.includes(broadcast.channelType));
    let guildCount = 0;
    logger.info('Loading guilds...');
    const noBroadcastGuilds : Guild[] = [];
    const infoOrBanshareBroadcastGuilds : Guild[] = [];
    for await (const oauthGuild of guilds) {
        const guild = client.guilds.cache.get(oauthGuild[0]);
        if (!guild) continue;
        let webhooks: Collection<string, Webhook<WebhookType.Incoming | WebhookType.ChannelFollower>>;
        try {
            await Promise.all([
                await guild.members.fetch(),
                webhooks = await guild.fetchWebhooks(),
            ]);
        } catch(error) {
            logger.error(`Could not load ${guild.name}`, (error as Error));
            continue;
        }
        webhooks = webhooks.filter((webhook) => webhook.owner?.id === client.user?.id);
        const guildChatBroadcasts = chatBroadcasts.filter((broadcast) => broadcast.guildId === guild.id);
        const guildOtherBroadcasts = otherBroadcasts.filter((broadcast) => broadcast.guildId === guild.id);
        if (!guildChatBroadcasts.length) {
            if(!guildOtherBroadcasts.length) {
                noBroadcastGuilds.push(guild);
            } else {
                infoOrBanshareBroadcastGuilds.push(guild);
            }
        }
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
            if(guildChatBroadcasts.length) {
                guildChatBroadcasts.forEach(async (broadcast) => {
                    if(!webhooks.find((webhook) => webhook.id === broadcast.webhookId)) {
                        logger.warn(`Deleted Aeon ${broadcast.channelType} (id: ${broadcast.webhookId}) from guild with id ${broadcast.guildId}, because it had no reference.`)
                        await databaseManager.deleteBroadcastByWebhookId(broadcast.webhookId);
                    }
                })
            }
        }
    }

    logger.info(`Loaded ${guildCount} guild${guildCount === 1 ? '' : 's'}`);
    logger.info(`Got ${noBroadcastGuilds.length} servers with no broadcasts.`);
    await Promise.all(noBroadcastGuilds.map((noBroadcastGuild) => {
        logger.info(`${noBroadcastGuild.name} ${noBroadcastGuild.id}\nMembers: ${noBroadcastGuild.memberCount} Channels: ${noBroadcastGuild.channels.cache.size}`);
    }))

    
    await statusUpdate(guilds);
    cron.schedule('*/5 * * * *', async () => {
        await statusUpdate(guilds);
    });

    cron.schedule('7 1 */2 * *', async () => {
        await experimentalPatchWarning();
    })
});