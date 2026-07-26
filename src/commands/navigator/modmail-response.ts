import { Command } from '../../structures/command';
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { modmailHandler } from '../../functions/modmail';
import { ApplicationCommandOptionType } from 'discord.js';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { RunOptions } from '../../types/command';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { errorHandler } from '../../structures/error-handler';

const logger = new Logger('CrowdControlCmd');

export const modmailResponseChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);
    
    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: false, onlyLocal: false},
        options.interaction.guild,
        [],
        PermissionLevels.NAVIGATOR);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral" });
        throw new Error(ErrorNames.NO_PERMISSIONS);
    }

    await modmailResponseCommand(options);
}

// TODO: test
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
        try {
            await modmailResponseChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.MODMAIL_RESPONSE
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const modmailResponseCommand = async (options: RunOptions) => {
        await databaseManager.getModmail(options.interaction.channelId);
        await modmailHandler.forwardModmailMessage(undefined, options);
}