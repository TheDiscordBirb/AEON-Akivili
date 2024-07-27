import { ActivityType, GuildTextBasedChannel } from "discord.js";
import { client } from "../structures/client";
import { Event } from "../structures/event";
import { Logger } from '../logger';
import { databaseManager } from "../structures/database";
import { NetworkJoinOptions } from "../types/command";
import { StartUpOptions } from "../types/event";

const logger = new Logger('Ready');

export default new Event("ready", async () => {
    logger.info("Bot is online");
    const guilds = await client.guilds.fetch();
    logger.info('Loading guilds...');
    for await (const oauthGuild of guilds) {
        const guild = client.guilds.cache.find((guild) => guild.id === oauthGuild[0]);
        if (!guild) continue;
        const guildBroadcasts = (await databaseManager.getBroadcasts()).filter((broadcast) => broadcast.guildId === guild.id);
        if (!guildBroadcasts) continue;
        logger.info(`Loaded guild "${guild.name}" (id: ${guild.id}).`);
        await Promise.allSettled([
            guild.channels.fetch(),
            guild.members.fetch(),
        ]);
        for await (const guildBroadcast of guildBroadcasts) {
            try {
                const aeonChannel = guild.channels.cache.find((channel) => channel.id === guildBroadcast.channelId && guildBroadcast.channelType !== NetworkJoinOptions.BANSHARE) as GuildTextBasedChannel;
                if (!aeonChannel) continue;
                logger.info(`Fetching messages from "${aeonChannel.name}"`);
                const loadedMessages = await aeonChannel.messages.fetch({ limit: StartUpOptions.NUMBER_OF_MESSAGES_TO_LOAD });
                logger.info(`Fetched the last ${loadedMessages.size} messages`);
            }
            catch (error) {
                logger.error(`There was an error fetching messages: `, error as Error);
            }
        }
    }
    const guildCount = client.guilds.cache.size;
    logger.info(`Loaded ${guildCount} guild${guildCount === 1 ? '' : 's'}`);

    client.user?.setPresence({
        activities: [{
            name: `over ${client.users.cache.size} trailblazers in ${client.guilds.cache.size} train cars`,
            type: ActivityType.Watching
        }],
        status: 'online'
    });

});