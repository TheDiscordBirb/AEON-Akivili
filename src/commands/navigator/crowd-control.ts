import { Command } from '../../structures/command';
import { Logger } from '../../logger';
import { config } from '../../const';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';

const logger = new Logger('CrowdControlCmd');

export default new Command({
    name: 'crowd-control',
    description: 'Enables/Disables crowd control.',
    options: [],

    run: async (options) => {
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }

        if (!options.interaction.member) {
            await options.interaction.reply({ content: `You cant use this command outside a server.`, ephemeral: true });
            logger.warn(`Didnt get interaction member`);
            return;
        }

        const permissionCheck = await permissionHandler.checkForPermission(
            options.interaction.user,
            {local: false, onlyLocal: false},
            options.interaction.guild,
            [],
            PermissionLevels.NAVIGATOR);
            
        if(!permissionCheck.status) {
            await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral"});
            return;
        }

        config.crowdControlActive = !config.crowdControlActive;
    
        await options.interaction.reply({content: `Crowd control has been set to ${config.crowdControlActive ? "active" : "inactive"}`, ephemeral: true});
    }
});