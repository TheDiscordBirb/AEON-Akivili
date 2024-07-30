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
    let guildCount = 0;
    let memberObjects: Collection<string, GuildMember> = new Collection();
    logger.info('Loading guilds...');
    for await (const oauthGuild of guilds) {
        const guild = client.guilds.cache.find((guild) => guild.id === oauthGuild[0]);
        if (!guild) continue;
        const guildBroadcasts = (await databaseManager.getBroadcasts()).filter((broadcast) => broadcast.guildId === guild.id);
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
                const loadedMessages = await aeonChannel.messages.fetch({ limit: config.numberOfMessagesToLoad });
                logger.info(`Fetched the last ${loadedMessages.size} messages`);
            }
            catch (error) {
                logger.error(`There was an error fetching messages: `, error as Error);
            }
        }
    }
    logger.info(`Loaded ${guildCount} guild${guildCount === 1 ? '' : 's'}`);

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