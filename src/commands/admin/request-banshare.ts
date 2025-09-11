import { Command } from '../../structures/command';
import { GuildMember } from 'discord.js'
import { hasModerationRights, Time } from '../../utils';
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { client } from '../../structures/client';
import { banshareManager } from '../../functions/banshare';

const logger = new Logger('RequestBanshareCmd');

export default new Command({
    name: 'request-banshare',
    description: 'Starts the process to request a banshare.',
    options: [],
    
    run: async (options) => {
        const guild = options.interaction.guild;
        if (!guild) {
            await options.interaction.reply({ content: "To have a complete paper trail of every banshare, this command can only be used in servers", ephemeral: true });
            return;
        }
        const broadcasts = await databaseManager.getBroadcasts();
        const userInfo = Object.values(broadcasts).reduce<{ guildMember?: GuildMember, userIsModerator: boolean }>((acc, broadcast) => {
            const guild = client.guilds.cache.get(broadcast.guildId);
            if (!guild) return acc;
            if (acc.userIsModerator) return acc;
            const guildMember = guild.members.cache.find((user) => user.id === options.interaction.member.id);
            if (!guildMember) return acc;
            if (hasModerationRights(guildMember)) {
                return {guildMember, userIsModerator: true};
            }
            return { guildMember, userIsModerator: false };
        }, { guildMember: undefined, userIsModerator: false });
        if (!userInfo.userIsModerator) {
            await options.interaction.reply({ content: "You dont have permissions to use this.", ephemeral: true });
        }
        await options.interaction.reply({ content: "Check your dms for a message from Akivili, if you cant find one enable dms from this server.", ephemeral: true });

        await banshareManager.dmBanshareFunction(guild.id, options);
    }
});