import { Command } from '../../structures/command';
import { ApplicationCommandOptionType} from 'discord.js'
import { databaseManager } from '../../structures/database';
import { Logger } from '../../logger';

const logger = new Logger('GetUidCmd');

// TODO: rework, test
export default new Command({
    name: 'get-uid',
    description: "Gets a person's uid using a message id from Aeon Chat",
    options:
    [{
        name: 'message-id',
        description: 'The id of the message you want to get the uid of.',
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
        const guildMember = options.interaction.guild?.members.cache.find(m => m.id === options.interaction.member.user.id);

        if (!guildMember) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }

        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', flags: 'Ephemeral' });
            return;
        }

        if (!options.interaction.channel) {
            logger.wtf(`${options.interaction.member.user.username} has used a command without a channel.`);
            return;
        }

        const messageId = options.args.getString('message-id');
        if (!messageId) {
            logger.warn(`${options.interaction.member.user.username} has used a command without the required field 'message-id'.`);
            await options.interaction.reply({ content: 'No message id provided.', flags: 'Ephemeral' });
            return;
        }
        let userId: string;
        try {
            userId = await databaseManager.getUserId(options.interaction.channel.id, messageId);
        } catch (error) {
            await options.interaction.reply({ content: 'There was an error fetching this user.', flags: 'Ephemeral' });
            logger.error(`There was an error fetching this user: ${messageId}`, error as Error);
            return;
        }
        await options.interaction.reply({ content: userId, flags: 'Ephemeral' });
    }
});