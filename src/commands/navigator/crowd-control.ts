import { Command } from '../../structures/command';
import { Logger } from '../../logger';
import { config } from '../../const';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { RunOptions } from '../../types/command';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { errorHandler } from '../../structures/error-handler';

const logger = new Logger('CrowdControlCmd');

export const crowdControlChecks = async (options: RunOptions) => {
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
    await crowdControlCommand(options);
}

export default new Command({
    name: 'crowd-control',
    description: 'Toggles crowd control.',
    options: [],

    run: async (options) => {
        try {
            await crowdControlChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.CROWD_CONTROL
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const crowdControlCommand = async (options: RunOptions) => {
    config.crowdControlActive = !config.crowdControlActive;
    await options.interaction.reply({
        content: `Crowd control has been set to ${config.crowdControlActive ? "active" : "inactive"}`, 
        flags: 'Ephemeral'
    });   
}