import { Command } from '../../structures/command';
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { modmailHandler } from '../../functions/modmail';
import { ApplicationCommandOptionType } from 'discord.js';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';

const logger = new Logger('CrowdControlCmd');

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