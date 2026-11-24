import { Command } from '../../structures/command';
import { Logger } from '../../logger';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { ButtonTypes, RunOptions } from '../../types/command';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { errorHandler } from '../../structures/error-handler';
import { config } from '../../const';
import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonInteraction, 
    ButtonStyle, 
    GuildTextBasedChannel, 
    LabelBuilder, 
    Message, 
    ModalBuilder, 
    TextDisplayBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} from 'discord.js';
import { readEmbedData } from '../../utils/embed-caching';
import { ModalInputIds, ModalTypes } from '../../types/modals';
import { ButtonIds } from '../../types/buttons';

const logger = new Logger('UpdateEmbedCmd');

export const updateEmbedChecks = async (options: RunOptions) => {
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
    const channel = await options.client.channels.fetch(config.infoMessageChannelId);
    if(!channel) throw new Error(ErrorNames.NO_CHANNEL);
    const infoMessage = (await (channel as GuildTextBasedChannel).messages.fetch()).find((message) => message.webhookId);
    if(!infoMessage) throw new Error(ErrorNames.NO_MESSAGE);

    await updateEmbedCommand(options);
}

export default new Command({
    name: 'update-embed',
    description: 'Used to update the info embed.',
    options: [],

    run: async (options) => {
        try {
            await updateEmbedChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.UPDATE_EMBED
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const updateEmbedCommand = async (options: RunOptions) => {
    const decryptedData = await readEmbedData();

    const buttonRow = new ActionRowBuilder<ButtonBuilder>();

    const addButton = new ButtonBuilder()
        .setCustomId(`${ButtonIds.UPDATE_EMBED} ${ButtonTypes.ADD_TO_EMBED}`)
        .setLabel("Add")
        .setStyle(ButtonStyle.Success)

    const removeButton = new ButtonBuilder()
        .setCustomId(`${ButtonIds.UPDATE_EMBED} ${ButtonTypes.REMOVE_FROM_EMBED}`)
        .setLabel("Remove")
        .setStyle(ButtonStyle.Danger)

    buttonRow.addComponents(addButton, removeButton)

    const collector = (await options.interaction.reply({
        embeds: decryptedData, 
        components: [buttonRow],
        flags: 'Ephemeral'
    })).createMessageComponentCollector();
    collector.on('collect', async (interaction) => {
        const buttonInteraction = interaction as ButtonInteraction;
        const modal = new ModalBuilder()
            .setCustomId(ModalTypes.UPDATE_EMBED);

        switch(buttonInteraction.customId.split(" ")[1]) {
            case ButtonTypes.ADD_TO_EMBED: {
                modal.setTitle("Add to the embed");
                modal.addLabelComponents(
                    new LabelBuilder()
                        .setLabel('Server name')
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId(ModalInputIds.EMBED_ADD_SERVER_NAME)
                                .setStyle(TextInputStyle.Short)
                        ),
                    new LabelBuilder()
                        .setLabel('Server invite')
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId(ModalInputIds.EMBED_ADD_SERVER_INVITE)
                                .setStyle(TextInputStyle.Short)
                        )
                )
                break;
            }
            case ButtonTypes.REMOVE_FROM_EMBED: {
                const serversEmbed = decryptedData[2];
                const servers: {name: string, invite: string}[] = [];
                serversEmbed.fields.map((field) => {
                    const regex = new RegExp(/★・\[(.*)\]\(https:\/\/discord.gg\/(.*)\)/g);
                    const match = field.value.matchAll(regex);
                    let serverValues = match.next();
                    while(!serverValues.done) {
                        servers.push({name: serverValues.value[1], invite: serverValues.value[2]})
                        serverValues = match.next();
                    }
                })
                let serversString = "## ID - SERVER NAME\n";
                for(const server of servers) {
                    serversString += `${server.invite} - ${server.name}\n`
                }
                

                modal.setTitle("Remove from the embed");
                modal.addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(serversString)
                )
                modal.addLabelComponents(
                    new LabelBuilder()
                        .setLabel('Server id')
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId(ModalInputIds.EMBED_REMOVE_SERVER)
                                .setStyle(TextInputStyle.Short)
                        )   
                )
                break;
            }
        }
        await interaction.showModal(modal).catch((e) => { logger.error(e, e, interaction.client.user.id) });
        
        config.cachedInteractions.push(options.interaction);
    })
}