import { Command } from '../../structures/command';
import { EmbedBuilder, Guild, PermissionFlagsBits} from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { Logger } from '../../logger';
import { client } from '../../structures/client';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';

const logger = new Logger('ListNetworkServersCmd');

export default new Command({
    name: 'list-network-servers',
    description: "Lists every server in the Aeon Network",
    options:
    [],

    run: async (options) => {
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }
        
        const permissionCheck = await permissionHandler.checkForPermission(
            options.interaction.user,
            {local: true, onlyLocal: false},
            options.interaction.guild,
            [PermissionFlagsBits.ManageChannels],
            PermissionLevels.REPRESENTATIVE);
            
        if(!permissionCheck.status) {
            await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral"});
            return;
        }
        
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }

        if (!options.interaction.channel) {
            logger.wtf(`${options.interaction.member.user.username} has used a command without a channel.`);
            return;
        }

        const broadcasts = await databaseManager.getBroadcasts();
        const guilds = broadcasts.reduce<Guild[]>((acc, broadcast) => {
            const guild = client.guilds.cache.get(broadcast.guildId);
            if (!guild) {
                return acc;
            }
            const guildInAcc = acc.find((accGuild) => accGuild === guild);
            if (!guildInAcc) {
                acc.push(guild);
            }
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

        await options.interaction.reply({ embeds: [serversEmbed], ephemeral: true });
    }
});