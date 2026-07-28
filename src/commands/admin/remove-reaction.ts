import { Command } from '../../structures/command';
import { ActionRow, ActionRowBuilder, ApplicationCommandOptionType, BaseGuildTextChannel, ButtonBuilder, ButtonComponent, ButtonInteraction, CacheType, ChannelType, ComponentType, Message, PermissionFlagsBits } from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { Logger } from '../../logger';
import { RunOptions } from '../../types/command';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { errorHandler } from '../../structures/error-handler';
import { Time } from '../../utils/time';

const logger = new Logger('RemoveReactionCmd');

// TODO: rework, test
const removeReactionChecks = async (options: RunOptions): Promise<void> => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);

    const channel = options.interaction.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);
    
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
    if (!messageId) throw new Error(ErrorNames.NO_REQUIRED_FIELD);

    const message = channel.messages.cache.get(messageId);
    if (!message) throw new Error(ErrorNames.NO_MESSAGE);

    const messageRecord = (await databaseManager.getMessages(message.channel.id, message.id))
        .find((record) => record.channelMessageId === message.id);
    if (!messageRecord) throw new Error(ErrorNames.NO_MESSAGE_IN_DB);

    await removeReactionCommand(options, message)
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

export const removeReactionCommand = async (options: RunOptions, message: Message<boolean>) => {
    const interactionReply = await (await options.interaction.reply({ 
            content: 'Click on the reaction you want to remove.',
            components: message.components,
            flags: 'Ephemeral'
        }
    )).fetch();

    interactionReply.createMessageComponentCollector({ time: Time.seconds(2) })
        .on('collect', (buttonInteraction) => {

        })
        .on('end', async (buttonInteraction) => {
            const disabledButtonRows: ActionRowBuilder<ButtonBuilder>[] = [];
            for(const row of interactionReply.components ) {
                const disabledButtonRow = new ActionRowBuilder<ButtonBuilder>();
                if(row.type === ComponentType.ActionRow) {
                    for(const component of row.components) {
                        if(component.type != ComponentType.Button) return;
                        const disabledButton = new ButtonBuilder({ ...component.data, disabled: true });
                        disabledButtonRow.addComponents(disabledButton);
                    }
                }
                disabledButtonRows.push(disabledButtonRow);
            }
            await interactionReply.edit({
                content: message.content,
                components: disabledButtonRows
            });
        })

}