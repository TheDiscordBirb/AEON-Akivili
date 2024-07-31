import { ActivityType, GuildMember, GuildTextBasedChannel, Collection } from "discord.js";
import { client } from "../structures/client";
import { Event } from "../structures/event";
import { Logger } from '../logger';
import { databaseManager } from "../structures/database";
import { NetworkJoinOptions } from "../types/command";
import { config } from "../const";

const logger = new Logger('Ready');

export default new Event("ready", async () => {
    logger.info("Bot is online");
    const guilds = await client.guilds.fetch();
    const broadcasts = await databaseManager.getBroadcasts();
    let guildCount = 0;
    let memberObjects: Collection<string, GuildMember> = new Collection();
    logger.info('Loading guilds...');
    for await (const oauthGuild of guilds) {
        const guild = client.guilds.cache.find((guild) => guild.id === oauthGuild[0]);
        if (!guild) continue;
        const guildBroadcasts = broadcasts.filter((broadcast) => broadcast.guildId === guild.id);
        if (!guildBroadcasts.length) continue;
        guildCount++;
        logger.info(`Loaded guild "${guild.name}" (id: ${guild.id}).`);
        await Promise.allSettled([
            guild.channels.fetch(),
            guild.members.fetch(),
        ]);
        memberObjects = memberObjects.concat(guild.members.cache);
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
    logger.info(`Loaded ${broadcasts.filter((broadcast) => broadcast.channelType === NetworkJoinOptions.BANSHARE).length} ${NetworkJoinOptions.BANSHARE} channels`);
    logger.info(`Loaded ${broadcasts.filter((broadcast) => broadcast.channelType === NetworkJoinOptions.STAFF).length} ${NetworkJoinOptions.STAFF} channels`);
    logger.info(`Loaded ${broadcasts.filter((broadcast) => broadcast.channelType === NetworkJoinOptions.GENERAL).length} ${NetworkJoinOptions.GENERAL} channels`);

    if (!client.user) {
        // TODO: write log
        return;
    }
    client.user.setPresence({
        activities: [{
            name: `over ${memberObjects.size} trailblazers in ${guildCount} train cars`,
            type: ActivityType.Watching
        }],
        status: 'online'
    });

});