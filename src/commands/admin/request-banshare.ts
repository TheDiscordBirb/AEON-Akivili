import { Command } from '../../structures/command';
import { Guild, GuildMember, PermissionFlagsBits } from 'discord.js'
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { banshareManager } from '../../functions/banshare';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { errorHandler } from '../../structures/error-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { RunOptions } from '../../types/command';
import { clients } from '../../structures/client';

const logger = new Logger('RequestBanshareCmd');

export const requestBanshareChecks = async (options: RunOptions) => {
    const guild = options.interaction.guild;
    if (!guild) throw new Error(ErrorNames.NO_GUILD);

    const broadcasts = await databaseManager.getBroadcasts();
    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: false},
        guild,
        [PermissionFlagsBits.BanMembers],
        PermissionLevels.REPRESENTATIVE
    );
            
    const userInfo = Object.values(broadcasts).reduce<{ guildMember?: GuildMember, userIsModerator: boolean }>((acc, broadcast) => {
        const client = clients.find((c) => c.guilds.cache.has(broadcast.guildId));
        if(!client) return acc;
        const guild = client.guilds.cache.get(broadcast.guildId);
        if (!guild) return acc;
        if (acc.userIsModerator) return acc;
        const guildMember = guild.members.cache.find((user) => user.id === options.interaction.member.id);
        if (!guildMember) return acc;
        if (permissionCheck) {
            return {guildMember, userIsModerator: true};
        }
        return { guildMember, userIsModerator: false };
    }, { guildMember: undefined, userIsModerator: false });

    if (!userInfo.userIsModerator) {
        await options.interaction.reply({ content: "You dont have permissions to use this.", flags: 'Ephemeral' });
        throw new Error(ErrorNames.NO_PERMISSIONS);
    }

    await requestBanshareCommand(options, guild);
}

// TODO: test
export default new Command({
    name: 'request-banshare',
    description: 'Starts the process to request a banshare.',
    options: [],
    
    run: async (options) => {
        try {
            await requestBanshareChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.REQUEST_BANSHARE
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const requestBanshareCommand = async (options: RunOptions, guild: Guild) => {
    await options.interaction.reply({
        content: "Check your dms for a message from Akivili, if you cant find one enable dms from this server.", 
        flags: 'Ephemeral'
    });
    await banshareManager.dmBanshareFunction(guild.id, options);
}