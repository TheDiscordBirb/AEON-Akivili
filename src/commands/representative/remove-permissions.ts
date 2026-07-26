import { Command } from '../../structures/command';
import { ApplicationCommandOptionType} from 'discord.js'
import { Logger } from '../../logger';
import { config } from '../../const';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { RunOptions } from '../../types/command';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { errorHandler } from '../../structures/error-handler';

const logger = new Logger('RmvPermCmd');

export const removePermissionChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);
            
    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: false, onlyLocal: false},
        options.interaction.guild,
        [],
        PermissionLevels.REPRESENTATIVE);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral" });
        throw new Error(ErrorNames.NO_PERMISSIONS);
    }

    await removePermissionCommand(options);
}

// TODO: test
export default new Command({
    name: 'remove-permisson',
    description: "Removes all staff permissions from a user.",
    options:
    [{
        name: 'user-id',
        description: 'The id of the user you want to remove the permissions of.',
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
        try {
            await removePermissionChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.REMOVE_PREMISSION
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
}); 

export const removePermissionCommand = async (options: RunOptions) => {
    config.suspendedPermissionUserIds.push(options.args.getString("user-id") ?? "");
    await options.interaction.reply({content: "User has had their permissions removed.", flags: "Ephemeral" });
}