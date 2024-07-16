import { ActivityType } from "discord.js";
import { client } from "../structures/client";
import { Event } from "../structures/event";
import { Logger } from '../logger';

const logger = new Logger('Ready');

export default new Event("ready", async () => {
    logger.info("Bot is online");
    const guilds = await client.guilds.fetch();
    logger.info('Loading guilds...');
    for await (const oauthGuild of guilds) {
        const guild = client.guilds.cache.find((guild) => guild.id === oauthGuild[0]);
        if (!guild) continue;
        logger.info(`Loaded guild "${guild.name}" (id: ${guild.id}).`);
        await Promise.allSettled([
            guild.channels.fetch(),
            guild.members.fetch(),
        ]);
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