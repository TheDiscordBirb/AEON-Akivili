import { Command } from '../../structures/command';
import { EmbedBuilder, Guild} from 'discord.js';
import { Logger } from '../../logger';
import { client } from '../../structures/client';
import { config } from '../../const';
import { clearanceLevel } from '../../utils';
import { ClearanceLevel } from '../../types/client';

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

        const guildMember = options.interaction.guild.members.cache.find(m => m.id === options.interaction.member.user.id);

        if (!guildMember) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }
            
        if(clearanceLevel(guildMember.user, guildMember.guild, true) === ClearanceLevel.MODERATOR) {
            await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
            return;
        }

        if (!options.interaction.channel) {
            logger.wtf(`${options.interaction.member.user.username} has used a command without a channel.`);
            return;
        }

        const webhooks = config.activeWebhooks;
        const guilds = webhooks.reduce<Guild[]>((acc, webhook) => {
            if(config.nonChatWebhooks.includes(webhook.name)) return acc;
            const guild = client.guilds.cache.get(webhook.guildId);
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