import { Command } from '../../structures/command';
import { ApplicationCommandOptionType} from 'discord.js'
import { databaseManager } from '../../structures/database';
import { Logger } from '../../logger';
import { RunOptions } from '../../types/command';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { errorHandler } from '../../structures/error-handler';

const logger = new Logger('GetUidCmd');

export const getUidChecks = async (options: RunOptions) => {
        if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);
        if (!options.interaction.channel) throw new Error(ErrorNames.NO_CHANNEL);

        const messageId = options.args.getString('message-id');
        if (!messageId) throw new Error(ErrorNames.NO_REQUIRED_FIELD);

        await getUidCommand(options, messageId);
}

// TODO: test
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
        try {
            await getUidChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.GET_UID
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const getUidCommand = async (options: RunOptions, messageId: string) => {
    const userId = await databaseManager.getUserId(options.interaction.channelId, messageId);
    await options.interaction.reply({ content: userId, flags: 'Ephemeral' });
}