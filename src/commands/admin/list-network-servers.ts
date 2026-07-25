import { Command } from '../../structures/command';
import { EmbedBuilder, Guild, PermissionFlagsBits} from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { Logger } from '../../logger';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { clients } from '../../structures/client';
import { RunOptions } from '../../types/command';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { errorHandler } from '../../structures/error-handler';

const logger = new Logger('ListNetworkServersCmd');

// TODO: test
export const listNetworkServerChecks = async(options: RunOptions) => {
    if (!options.interaction.guild) {
        throw new Error(ErrorNames.NO_GUILD)
    }
    
    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: false},
        options.interaction.guild,
        [PermissionFlagsBits.ManageChannels],
        PermissionLevels.REPRESENTATIVE);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral" });
        throw new Error(ErrorNames.NO_PERMISSIONS)
    }
    
    await listNetworkServerCommand(options);
}

export default new Command({
    name: 'list-network-servers',
    description: "Lists every server in the Aeon Network",
    options:
    [],

    run: async (options) => {
        try {
            await listNetworkServerChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.LIST_NETWORK_SERVERS
            })
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);
        }
    }
});

export const listNetworkServerCommand = async(options: RunOptions) => {
    const broadcasts = await databaseManager.getBroadcasts();
    const guilds = broadcasts.reduce<Guild[]>((acc, broadcast) => {
        const client = clients.find((client) => client.user?.id === broadcast.serviceClientId);
        if(!client) return acc;
        const guild = client.guilds.cache.get(broadcast.guildId);
        if (!guild) return acc;
        const guildInAcc = acc.find((accGuild) => accGuild === guild);
        if (!guildInAcc) acc.push(guild);
        return acc;
    }, []);

    const serversEmbed = new EmbedBuilder()
        .setTitle("Servers with an Aeon Network channel connection:");
        
    const fields: { name: string, value: string, inline: boolean }[] = [];

    let column = "";
    guilds.sort().forEach((guild, idx) => {
        column += `${guild.name}\n`;
        if (idx % 20 === 0 && idx != 0 || idx === guilds.length - 1) {
            fields.push({ name: "Servers:", value: column, inline: true });
            column = "";
        }
    });
    serversEmbed.addFields(fields);

    await options.interaction.reply({ embeds: [serversEmbed], flags: 'Ephemeral' });
}