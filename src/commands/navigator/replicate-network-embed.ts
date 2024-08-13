import { Command } from '../../structures/command';
import { ApplicationCommandOptionType} from 'discord.js'
import { Logger } from '../../logger';
import { hasModerationRights, isNavigator, rebuildNetworkInfoEmbeds } from '../../utils';

const logger = new Logger('ReplicateEmbedData');

export default new Command({
    name: 'replicate-network-embed',
    description: "Used for cloning embeds.",
    options:
    [{
        name: 'message-id',
        description: 'The id of the network embed message.',
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
        const guildMember = options.interaction.guild?.members.cache.find(m => m.id === options.interaction.member.user.id);

        if (!guildMember) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }

        if (!isNavigator(options.interaction.user)) {
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

        const messageId = options.args.getString('message-id');
        if (!messageId) {
            logger.warn(`${options.interaction.member.user.username} has used a command without the required field 'message-id'.`);
            await options.interaction.reply({ content: 'No message id provided.', ephemeral: true });
            return;
        }

        const message = await options.interaction.channel.messages.fetch(messageId);

        const embeds = await rebuildNetworkInfoEmbeds(message);
        await options.interaction.reply({ embeds: embeds });
    }
});