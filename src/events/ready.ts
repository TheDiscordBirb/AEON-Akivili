import {
    GuildMember,
    GuildTextBasedChannel,
    Collection,
    Webhook,
    WebhookType
} from "discord.js";
import { client } from "../structures/client";
import { Event } from "../structures/event";
import { Logger } from '../logger';
import { config } from "../const";
import { statusUpdate } from "../utils";
import cron from 'node-cron';

const logger = new Logger('Ready');

export default new Event("ready", async () => {
    logger.info("Bot is online");
    const guilds = await client.guilds.fetch();
    let memberObjects: Collection<string, GuildMember> = new Collection();
    let guildCount = 0;
    logger.info('Loading guilds...');
    for await (const oauthGuild of guilds) {
        const guild = client.guilds.cache.get(oauthGuild[0]);
        if (!guild) continue;
        let webhooks: Collection<string, Webhook<WebhookType.Incoming | WebhookType.ChannelFollower>>;
        await Promise.all([
            guild.members.fetch(),
            webhooks = await guild.fetchWebhooks(),
        ]);
        const guildWebhooks = webhooks.filter((webhook) => webhook.guildId === guild.id);
        if(!guildWebhooks.size) continue;
        logger.info(`Loaded guild "${guild.name}" (id: ${guild.id}).`);
        logger.info(`Fetched ${guildWebhooks.size} webhooks and ${guild.memberCount} members.`);
        guildCount++;
        memberObjects = memberObjects.concat(guild.members.cache);
        webhooks.map(async (webhook) => {
            try {
                if(!webhook.owner || !client.user) {
                    logger.warn(`Could not load (${webhook.sourceGuild?.name} | ${webhook.channel?.name}) webhook.`);
                    return;
                }
                if(webhook.owner.id !== client.user.id) {
                    return;
                }
                config.activeWebhooks.push(webhook);
                guild.channels.fetch(webhook.channelId);
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
    }

    logger.info(`Loaded ${guildCount} guild${guildCount === 1 ? '' : 's'}`);

    
    await statusUpdate(guilds);
    cron.schedule('*/5 * * * *', async () => {
        await statusUpdate(guilds);
    });
});