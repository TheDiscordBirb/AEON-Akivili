import { Command } from '../../structures/command';
import { ApplicationCommandOptionType, Embed, EmbedBuilder, Guild} from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { hasModerationRights } from '../../utils';
import { Logger } from '../../logger';
import { BroadcastRecord } from '../../types/database';
import { client } from '../../structures/client';

const logger = new Logger('GetUidCmd');

export default new Command({
    name: 'list-network-servers',
    description: "Lists every server in the Aeon Network",
    options:
    [],

    run: async (options) => {
        const guildMember = options.interaction.guild?.members.cache.find(m => m.id === options.interaction.member.user.id);

        if (!guildMember) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }

        if (!hasModerationRights(guildMember)) {
            await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
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
        guilds.forEach((guild, idx) => {
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