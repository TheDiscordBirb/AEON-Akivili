import { 
    BaseGuildTextChannel,
    Client,
    Collection,
    Guild,
    GuildTextBasedChannel,
    Webhook,
    WebhookType,
} from "discord.js";
import { Event } from "../structures/event";
import { Logger } from '../logger';
import { databaseManager } from "../structures/database";
import { config } from "../const";
import { statusUpdate } from "../utils/misc";
import cron from 'node-cron';
import { NetworkJoinOptions } from "../types/command";
import { clients } from "../structures/client";

const logger = new Logger('Ready');

export default new Event("clientReady", async (client: Client) => {
    const guilds = await client.guilds.fetch();
    const clientId = client.user?.id ?? "-";
    const broadcasts = await databaseManager.getBroadcasts();
    const chatBroadcasts = broadcasts.filter((broadcast) => !config.nonChatWebhooksTypes.includes(broadcast.channelType));
    const otherBroadcasts = broadcasts.filter((broadcast) => config.nonChatWebhooksTypes.includes(broadcast.channelType));
    let guildCount = 0;
    logger.info('Loading guilds...', clientId);
    const noBroadcastGuilds : Guild[] = [];
    const infoOrBanshareBroadcastGuilds : Guild[] = [];
    const textWebhooks : Webhook[] = [];
    await client.user?.setUsername(config.clientName);
    for await (const oauthGuild of guilds) {
        const guild = client.guilds.cache.get(oauthGuild[0]);
        if (!guild) continue;
        let webhooks: Collection<string, Webhook<WebhookType.Incoming | WebhookType.ChannelFollower>>;
        try {
            await guild.members.fetch()
        } catch(error) {
            logger.error(`Could not load ${guild.name} members.`, (error as Error), clientId);
        }
        try {
            webhooks = await guild.fetchWebhooks();
        } catch(error) {
            logger.error(`Could not load ${guild.name} webhooks.`, (error as Error), clientId);
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
        if(guildChatBroadcasts.length) {
            const stickerStatus = await databaseManager.getServerStickerStatus(guild.id);
            if(stickerStatus === null) {
                await databaseManager.saveServerStickerStatus(guild.id, true, clientId);
            }
        }
        guildCount++;
        let networkServer = false;
        logger.info(`Trying to load guild "${guild.name}" (id: ${guild.id})`, clientId);
        webhooks.map(async (webhook) => {
            try {
                if(!webhook.owner || !client.user) {
                    logger.warn(`Could not load (${webhook.sourceGuild?.name} | ${webhook.channel?.name}) webhook.`, undefined, clientId);
                    return;
                }
                if(webhook.owner.id !== client.user.id) return;
                const broadcast = await databaseManager.getBroadcastByWebhookId(webhook.id);
                if(!broadcast) {
                    logger.warn(`Could not get broadcast for webhook ${webhook.id}`, undefined, clientId);
                    return;
                }
                logger.info(`Loaded ${broadcast.channelType} ${webhook.id}`, clientId);
                config.activeWebhooks.push(webhook);
                if(broadcast.channelType === NetworkJoinOptions.INFO) {
                    const channel = await guild.channels.fetch(webhook.channelId);
                    if(!channel) return;
                    await (channel as GuildTextBasedChannel).messages.fetch();
                }
                if(config.nonChatWebhooksTypes.includes(broadcast.channelType)) return;
                if(!networkServer) {                
                    logger.info(`Loaded guild "${guild.name}" (id: ${guild.id}).`, clientId);
                    logger.info(`Fetched ${webhooks.size} webhooks and ${guild.memberCount} members.`, clientId);
                }
                const aeonChannel = await guild.channels.fetch(webhook.channelId);
                if(!aeonChannel) return;
                networkServer = true;
                textWebhooks.push(webhook);
                const timeStart = Date.now();
                const loadedMessages = await (aeonChannel as GuildTextBasedChannel).messages.fetch({ limit: config.numberOfMessagesToLoad });
                logger.info(`Fetched the last ${loadedMessages.size} messages from ${aeonChannel.name} in ${Date.now() - timeStart}ms`, clientId);
            }
            catch (error) {
                logger.error(`There was an error fetching messages: `, error as Error, clientId);
            }
        })
        if(config.cleanDbMode && guildChatBroadcasts.length) {
            guildChatBroadcasts.forEach(async (broadcast) => {
                if(!webhooks.find((webhook) => webhook.id === broadcast.webhookId)) {
                    logger.warn(`Deleted Aeon ${broadcast.channelType} (id: ${broadcast.webhookId}) from guild with id ${broadcast.guildId}, because it had no reference.`, undefined, clientId)
                    await databaseManager.deleteBroadcastByWebhookId(broadcast.webhookId);
                }
            })
        }
    }

    logger.info(`Loaded ${guildCount} guild${guildCount === 1 ? '' : 's'}`, clientId);
    logger.info(`Got ${noBroadcastGuilds.length} servers with no broadcasts.`, clientId);
    await Promise.all(noBroadcastGuilds.map((noBroadcastGuild) => {
        logger.info(`${noBroadcastGuild.name} ${noBroadcastGuild.id}\nMembers: ${noBroadcastGuild.memberCount} Channels: ${noBroadcastGuild.channels.cache.size}`, clientId);
    }));
    await botsReady();
    await Promise.all(textWebhooks.map(async (webhook) => {
        try {
            await (webhook.channel as BaseGuildTextChannel).send({content: `\`\`\`${client.user?.username} is now online.\`\`\``});
        } catch(e) {
            logger.warn((e as Error).message, undefined ,clientId);
            return;
        }
    }));

    
    await statusUpdate();
    cron.schedule('*/5 * * * *', async () => {
        await statusUpdate();
    });

    //cron.schedule('7 1 */2 * *', async () => {
    //    await experimentalPatchWarning();
    //})
});

const botsReady = async () => {
    config.loadedClients++;
    if(config.loadedClients === clients.length) {
        for(const client of clients) {
            logger.info(`${client.user?.username} (${client.user?.id}) is online`, client.user?.id ?? "-");
        }
        config.botStarting = false;
    }
}