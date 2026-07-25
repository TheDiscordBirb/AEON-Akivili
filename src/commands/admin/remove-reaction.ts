import { Command } from '../../structures/command';
import { ApplicationCommandOptionType, BaseGuildTextChannel, ChannelType, PermissionFlagsBits } from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { Logger } from '../../logger';
import { RunOptions } from '../../types/command';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { errorHandler } from '../../structures/error-handler';

const logger = new Logger('RemoveReactionCmd');

// TODO: rework, test
const removeReactionChecks = async (options: RunOptions): Promise<void> => {
    if (!options.interaction.guild) {
        await options.interaction.reply({ content: 'You cant use this here', flags: 'Ephemeral' });
        return;
    }

    if (!options.interaction.channel) {
        await options.interaction.reply({ content: `Could not get interaction channel.`, flags: 'Ephemeral' });
        return;
    }
    const channel = options.interaction.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) return;
    
    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: false},
        options.interaction.guild,
        [PermissionFlagsBits.ManageMessages],
        PermissionLevels.REPRESENTATIVE);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral" });
        throw new Error(ErrorNames.NO_PERMISSIONS)
    }

    const messageId = options.args.getString('message-id');
    if (!messageId) {
        throw new Error(ErrorNames.NO_REQUIRED_FIELD);
    }

    const message = channel.messages.cache.get(messageId);
    if (!message) {
        throw new Error(ErrorNames.NO_INTERACTION_CHANNEL);
    }

    const messageRecord = (await databaseManager.getMessages(message.channel.id, message.id)).find((record) => record.channelMessageId === message.id);
    if (!messageRecord) {
        await options.interaction.reply({ content: `Could not find message in database.`, flags: 'Ephemeral' });
        // TODO: write log
        return;
    }

    const interactionReply = await (await options.interaction.reply(
        { 
            content: message.content,
            components: message.components,
            flags: 'Ephemeral'
        }
    )).fetch();
            
    await databaseManager.logMessage({ ...messageRecord, channelMessageId: interactionReply.id });
}


export default new Command({
    name: 'remove-reaction',
    description: 'Removes reactions from a network message.',
    options: [
        {
            name: 'message-id',
            description: 'The id of the message you want to remove a reacion from.',
            type: ApplicationCommandOptionType.String,
            required: true
        },
    ],
    
    run: async (options) => {
            try {
                await removeReactionChecks(options);
            } catch(e) {
                await errorHandler.showError({
                    error: e as Error,
                    user: options.interaction.user,
                    interactionType: InteractionTypes.REMOVE_REACTION
                });
                logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
            }
    }
});

export const removeReactionCommand = async () => {

}