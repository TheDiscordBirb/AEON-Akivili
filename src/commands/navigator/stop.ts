import { Command } from '../../structures/command';
import { Logger } from '../../logger';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { RunOptions } from '../../types/command';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { errorHandler } from '../../structures/error-handler';

const logger = new Logger('StopCmd');

export const stopChecks = async (options: RunOptions) => {
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
    await stopCommand(options);
}

export default new Command({
    name: 'stop',
    description: 'Emergency stop.',
    options: [],

    run: async (options) => {
        try {
            await stopChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.STOP
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const stopCommand = async (options: RunOptions) => {
    await options.client.destroy();
}