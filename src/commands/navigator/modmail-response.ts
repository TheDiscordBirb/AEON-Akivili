import { Command } from '../../structures/command';
import { clearanceLevel } from '../../utils';
import { ClearanceLevel } from '../../types/client';
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { modmailHandler } from '../../functions/modmail';
import { ApplicationCommandOptionType } from 'discord.js';

const logger = new Logger('ModmailResponseCmd');

export default new Command({
    name: 'modmail-response',
    description: 'Used to respond to modmails.',
    options: 
    [{
        name: "message",
        description: "The text sent to the user.",
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
        if (!options.interaction.member) {
            await options.interaction.reply({ content: `You cant use this command outside a server.`, ephemeral: true });
            logger.warn(`Didnt get interaction member`);
            return;
        }
        if (!(clearanceLevel(options.interaction.user) >= ClearanceLevel.NAVIGATOR)) {
            await options.interaction.reply({ content: `You do not have permission to use this!`, ephemeral: true });
            return;
        }
        try {
            await databaseManager.getModmail(options.interaction.channelId);
            await modmailHandler.forwardModmailMessage(undefined, options);
        } catch (error) {
            if((error as Error).message === "Could not find modmail.") {
                await options.interaction.reply({content: "Could not find a modmail associated with this channel.", ephemeral: true});
            }
        }
    }
});