import { Command } from '../../structures/command';
import { ApplicationCommandOptionType} from 'discord.js'
import { Logger } from '../../logger';
import { config } from '../../const';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';

const logger = new Logger('RmvPermCmd');

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
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }
                
        const permissionCheck = await permissionHandler.checkForPermission(
            options.interaction.user,
            {local: false, onlyLocal: false},
            options.interaction.guild,
            [],
            PermissionLevels.REPRESENTATIVE);
            
        if(!permissionCheck.status) {
            await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral"});
            return;
        }
        
        config.suspendedPermissionUserIds.push(options.args.getString("user-id") ?? "");
        await options.interaction.reply({content: "User has had their permissions removed.", flags: "Ephemeral"});
        return;
    }
}); 