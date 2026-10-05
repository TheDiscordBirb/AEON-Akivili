import { Command } from '../../structures/command';
import { Logger } from '../../logger';
import { config } from '../../const';
import { ApplicationCommandOptionType } from 'discord-api-types/v10';
import { errorHandler } from '../../structures/error-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { ExtendedClientTypes } from '../../types/client';
import { RunOptions } from '../../types/command';
import { databaseManager } from '../../structures/database';

const logger = new Logger('ModifyClientCmd');

export const modifyClientTypeChecks = async (options: RunOptions) => {
    if(!config.devIds.includes(options.interaction.user.id)) throw new Error(ErrorNames.NO_PERMISSIONS);

    const type = options.args.getString("type");
    if(!type) throw new Error(ErrorNames.NO_REQUIRED_FIELD);

    const clientUser = options.client.user;
    if(!clientUser) throw new Error(ErrorNames.NO_CLIENT_USER);

    const cachedClients = await databaseManager.loadClientTypes();
    const cachedClient = cachedClients.find((c) => c.clientId === clientUser.id);
    if(!cachedClient) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);
    if(cachedClient.type === ExtendedClientTypes.LIVE) throw new Error(ErrorNames.CAN_NOT_CHANGE_TYPE);
    
    await modifyClientTypeCommand(options, clientUser.id, type as ExtendedClientTypes);
}

export default new Command({
    name: 'modify-client-type',
    description: "Modifies this client's type.",
    options: 
        [{
            name: 'type',
            description: 'The type of the client.',
            type: ApplicationCommandOptionType.String,
            choices: [
                { name: "Live", value: ExtendedClientTypes.LIVE },
                { name: "Beta", value: ExtendedClientTypes.BETA },
                { name: "Alpha", value: ExtendedClientTypes.ALPHA}
            ],
            required: true
        }],
    
    run: async (options) => {
        try {
            await modifyClientTypeChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.MODIFY_CLIENT_TYPE
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);
        }
    }
});

export const modifyClientTypeCommand = async (options: RunOptions, clientId: string, type: ExtendedClientTypes) => {
    await databaseManager.modifyClientType(clientId, type);
    await options.interaction.reply({ 
        content: `${options.client.user?.displayName} has been set to ${type.toUpperCase()}`,
        flags: ['Ephemeral'] 
    });
}