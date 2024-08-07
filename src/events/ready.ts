import { GuildMember, GuildTextBasedChannel, Collection } from "discord.js";
import { client } from "../structures/client";
import { Event } from "../structures/event";
import { Logger } from '../logger';
import { databaseManager } from "../structures/database";
import { NetworkJoinOptions } from "../types/command";
import { config } from "../const";
import { statusUpdate } from "../utils";
import cron from 'node-cron';

const logger = new Logger('Ready');

export default new Event("ready", async () => {
    logger.info("Bot is online");
    const guilds = await client.guilds.fetch();
    const broadcasts = await databaseManager.getBroadcasts();
    let memberObjects: Collection<string, GuildMember> = new Collection();
    let guildCount = 0;
    logger.info('Loading guilds...');
    for await (const oauthGuild of guilds) {
        const guild = client.guilds.cache.find((guild) => guild.id === oauthGuild[0]);
        if (!guild) continue;
        const guildBroadcasts = broadcasts.filter((broadcast) => broadcast.guildId === guild.id);
        if (!guildBroadcasts.length) continue;
        guildCount++;
        memberObjects = memberObjects.concat(guild.members.cache);
        logger.info(`Loaded guild "${guild.name}" (id: ${guild.id}).`);
        logger.info(`Fetching channels and members. Guild id: ${guild.id}`);
        await Promise.all([
            guild.channels.fetch(),
            guild.members.fetch(),
        ]);
        logger.info(`Finished fetching channels and members for guild ${guild.id}. Channel cache size: ${guild.channels.cache.size} Members cache size: ${guild.members.cache.size}`);
        for await (const guildBroadcast of guildBroadcasts) {
            try {
                const aeonChannel = guild.channels.cache.find((channel) => channel.id === guildBroadcast.channelId && guildBroadcast.channelType !== NetworkJoinOptions.BANSHARE) as GuildTextBasedChannel;
                if (!aeonChannel) continue;
                logger.info(`Fetching messages from "${aeonChannel.name}"`);
                const timeStart = Date.now();
                const loadedMessages = await aeonChannel.messages.fetch({ limit: config.numberOfMessagesToLoad });
                logger.info(`Fetched the last ${loadedMessages.size} messages in ${Date.now() - timeStart}ms`);
            }
            catch (error) {
                logger.error(`There was an error fetching messages: `, error as Error);
            }
        }
    }

    logger.info(`Loaded ${guildCount} guild${guildCount === 1 ? '' : 's'}`);

    
    await statusUpdate(guilds);
    cron.schedule('*/5 * * * *', async () => {
        await statusUpdate(guilds);
    });
});