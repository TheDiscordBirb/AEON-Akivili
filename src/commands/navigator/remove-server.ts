import { Command } from '../../structures/command';
import {
    ActionRow,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    Client,
    Collection,
    ComponentType,
    EmbedBuilder,
    Guild,
    Interaction,
    MessageActionRowComponent,
    MessageActionRowComponentBuilder,
    MessageFlags,
    OAuth2Guild,
    StringSelectMenuBuilder
} from 'discord.js'
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { config } from '../../const';
import { ButtonTypes, RunOptions } from '../../types/command';
import { BroadcastRecord } from '../../types/database';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { removeServerButtons } from '../../functions/buttons';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { clients } from '../../structures/client';
import { errorHandler } from '../../structures/error-handler';

const logger = new Logger('RemoveServerCmd');

export const removeServerChecks = async (options: RunOptions) => {
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

    await removeServerCommand(options);
}

// TODO: test
export default new Command({
    name: 'remove-server',
    description: "Used for removing servers/webhooks from the network.",
    options:[],

    run: async (options) => {
        try {
            await removeServerChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.REMOVE_SERVER
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }

});

export const removeServerCommand = async (options: RunOptions) => {
    const broadcasts = await databaseManager.getBroadcasts();
    const segmentedServerListEmbedFields = await buildList(broadcasts);
    const serverSelection = await buildServerSelectionMessage(
        segmentedServerListEmbedFields[0], 
        options.interaction.user.id, 
        segmentedServerListEmbedFields.length, 
        1
    );

    const firstReply = await options.interaction.reply({
        embeds: [serverSelection.embed], 
        components: serverSelection.components, 
        flags: MessageFlags.Ephemeral
    });
    const filter = (i : Interaction) => {
        return i.user.id === options.interaction.user.id;
    }

    const serverSelectionCollector = firstReply.createMessageComponentCollector({ filter });
    serverSelectionCollector.on('collect', async (componentInteraction) => {
        if(componentInteraction.componentType != ComponentType.Button 
            && componentInteraction.componentType != ComponentType.StringSelect) {
                throw new Error(ErrorNames.WRONG_BUTTON_TYPE);
        }
        await removeServerButtons(
            componentInteraction,
            serverSelection,
            segmentedServerListEmbedFields,
            options,
            firstReply,
        )
    })
}

export const buildList = async (broadcasts: BroadcastRecord[]): Promise<({name: string, value: string})[][]> => {
    const clientGuilds = new Map<string, Guild>();
    await Promise.allSettled(clients.map((c) => {
        c.guilds.cache.map((g) => {
            clientGuilds.set(g.id, g)
        })
    }))
    const serverListEmbedFields: ({name: string, value: string})[] = [];
    const segmentedServerListEmbedFields: ({name: string, value: string})[][] = [];
    clientGuilds.forEach(async (guild) => {
        let broadcastList = "";
        const guildBroadcasts = broadcasts.filter((broadcast) => broadcast.guildId === guild.id);
        guildBroadcasts.forEach((broadcast) => {
            broadcastList += broadcast.channelType + '\n';
        })
        broadcastList.slice(0, (broadcastList.length ? broadcastList.length - "\n".length : 0));
        if(!broadcastList) {
            broadcastList = '||This server does not have any webhooks.||';
        }
        serverListEmbedFields.push({name: `${guild.name}`, value: broadcastList});
    });
    let currentServerListPage = 0;
    serverListEmbedFields.forEach((embedField, idx) => {
        if(idx%config.embedFieldLimit == 0 && idx != 0) currentServerListPage++;

        segmentedServerListEmbedFields[currentServerListPage] = ([] as {name: string, value: string}[])
            .concat(embedField)
            .concat(segmentedServerListEmbedFields[currentServerListPage])
            .filter((list) => list != undefined);
    })
    
    return segmentedServerListEmbedFields;
}

export const buildServerSelectionMessage = async (
    list: ({name: string, value: string})[],
    interactionUserId: string, 
    pages: number, 
    currentPage: number
): Promise<({embed: EmbedBuilder, components: ActionRowBuilder<MessageActionRowComponentBuilder>[]})> => {
    const serverSelectorActionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
    const directionButtonActionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
    let actionRows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

    const serverListEmbed = new EmbedBuilder()
        .setTitle('Please select the server you want to modify.')
    const backButton = new ButtonBuilder()
        .setEmoji('⬅️')
        .setCustomId(`${interactionUserId} ${ButtonTypes.BACK} ${currentPage}`)
        .setStyle(ButtonStyle.Secondary)
    
    const forwardButton = new ButtonBuilder()
        .setEmoji('➡️')
        .setCustomId(`${interactionUserId} ${ButtonTypes.FORWARD} ${currentPage}`)
        .setStyle(ButtonStyle.Secondary)

    if(currentPage === 1) {
        backButton.setDisabled(true);
    }
    if(currentPage === pages) {
        forwardButton.setDisabled(true);
    }
    
    const serverSelector = new StringSelectMenuBuilder()
        .setCustomId(`${interactionUserId} ${ButtonTypes.SERVER_SELECTOR}`)
        .setPlaceholder("Select a server.")
    
    list.forEach((embedField) => {
        const client = clients.find((c) => c.guilds.cache.find((guild) => guild.name === embedField.name));
        if(!client) return;
        const guild = client.guilds.cache.find((guild) => guild.name === embedField.name);
        if(!guild) return;
        serverSelector.addOptions({label: embedField.name, value: guild.id});
    });
    
    serverSelectorActionRow.setComponents([serverSelector]);
    directionButtonActionRow.setComponents([backButton, forwardButton]);
    
    serverListEmbed.setFields(list);
    
    if(pages == 1) {
        forwardButton.setDisabled(true);
        directionButtonActionRow.components.length = 0;
        directionButtonActionRow.addComponents([backButton, forwardButton]);
    }
    actionRows.push(serverSelectorActionRow, directionButtonActionRow);
    return({embed: serverListEmbed, components: actionRows});
}

export const buildServerRemovalUi = async (
    options: RunOptions, 
    selectedServerId: string
): Promise<({ embed: EmbedBuilder, components: ActionRowBuilder<MessageActionRowComponentBuilder>[] })> => {
    const client = clients.find((client) => client.guilds.cache.has(selectedServerId));
    if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_SERVER);
    const selectedServer = client.guilds.cache.get(selectedServerId);
    if(!selectedServer) throw new Error(ErrorNames.NO_GUILD);
    
    const serverAeonWebhooks = config.activeWebhooks.filter((webhook) => webhook.guildId === selectedServer.id);
    const webhookButtons = new ActionRowBuilder<ButtonBuilder>();
    await Promise.allSettled(serverAeonWebhooks.map(async (aeonWebhook) => {
        const broadcast = await databaseManager.getBroadcastByWebhookId(aeonWebhook.id);
        if(!broadcast) return;
        const button = new ButtonBuilder()
            .setCustomId(`${aeonWebhook.id} ${ButtonTypes.WEBHOOK} ${selectedServer.id}`)
            .setLabel(broadcast.channelType)
            .setStyle(ButtonStyle.Primary)
        
        webhookButtons.addComponents(button);
    }));

    const removeServerButtonActionRow = new ActionRowBuilder<ButtonBuilder>();
    const removeEverythingButton = new ButtonBuilder()
        .setCustomId(`${options.interaction.user.id} ${ButtonTypes.REMOVE_SERVER} ${selectedServer.id}`)
        .setLabel('Remove entire server.')
        .setStyle(ButtonStyle.Danger)
    removeServerButtonActionRow.addComponents(removeEverythingButton);
    
    const backToServersButtonActionRow = new ActionRowBuilder<ButtonBuilder>();
    const backToServersButton = new ButtonBuilder()
        .setCustomId(`${options.interaction.user.id} ${ButtonTypes.MENU_BACK}`)
        .setLabel('Back to servers')
        .setStyle(ButtonStyle.Success)
    backToServersButtonActionRow.addComponents(backToServersButton);

    const replyEmbed = new EmbedBuilder()
        .setTitle("Remove network connection")
        .setDescription(`To remove a connection from ${selectedServer.name} please click one of the buttons.`)

    const actionRows = [];
    if(webhookButtons.components.length) {
        actionRows.push(webhookButtons);
    }
    actionRows.push(removeServerButtonActionRow);
    actionRows.push(backToServersButtonActionRow);

    return({
        embed: replyEmbed,
        components: actionRows
    })
}

export const deleteWebhookButtonHandler = async (
    serverId: string, 
    selectedWebhookId: string, 
    componentInteraction: ButtonInteraction<CacheType>,
): Promise<ActionRowBuilder<MessageActionRowComponentBuilder>[]> => {
    const client = clients.find((client) => client.guilds.cache.has(serverId));
    if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_SERVER);
    const serverAeonWebhooks = config.activeWebhooks.filter((activeWebhook) => activeWebhook.guildId === serverId);
    const selectedWebhook = serverAeonWebhooks.find((webhook) => webhook.id === selectedWebhookId);
    if(!selectedWebhook) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK);

    const selectedWebhookPosition = config.activeWebhooks.findIndex((webhook) => webhook === selectedWebhook);
    try {
        config.activeWebhooks.splice(selectedWebhookPosition);
        await client.deleteWebhook(selectedWebhook.id);
        await databaseManager.deleteBroadcastByWebhookId(selectedWebhookId);
    } catch(error) {
        await componentInteraction.deferUpdate();
        throw error;
    }

    const message = componentInteraction.message;
    const webhookButtonsRow = new ActionRowBuilder<ButtonBuilder>();
    const removeServerButtonRow = new ActionRowBuilder<ButtonBuilder>();
    const backToMenuButtonRow = new ActionRowBuilder<ButtonBuilder>();
    message.components.map((row) => {
        (row as ActionRow<MessageActionRowComponent>).components.forEach((buttonComponent) => {
            if(buttonComponent.type === ComponentType.Button) {
                if(!buttonComponent.customId) {
                    logger.wtf("No button custom id.");
                    return;
                }
                if(!buttonComponent.label) {
                    logger.wtf("No button label.");
                    return;
                }
                const button = new ButtonBuilder()
                    .setCustomId(buttonComponent.customId)
                    .setLabel(buttonComponent.label)
                    .setStyle(buttonComponent.style)

                if(buttonComponent.customId !== componentInteraction.customId) {
                    switch(buttonComponent.customId.split(/ +/)[1]) {
                        case ButtonTypes.WEBHOOK:
                            webhookButtonsRow.addComponents(button);
                            break;
                        case ButtonTypes.REMOVE_SERVER:
                            removeServerButtonRow.addComponents(button);
                            break;
                        case ButtonTypes.MENU_BACK:
                            backToMenuButtonRow.addComponents(button);
                            break;
                    }
                }
            }
        })
    })
    const actionRow: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
    if(webhookButtonsRow.components.length) {
        actionRow.push(webhookButtonsRow);
    }
    actionRow.push(removeServerButtonRow, backToMenuButtonRow);
    return actionRow;
}