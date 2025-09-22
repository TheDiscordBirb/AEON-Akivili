import { Command } from '../../structures/command';
import {
    ActionRow,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ComponentType,
    EmbedBuilder,
    Interaction,
    MessageActionRowComponent,
    MessageActionRowComponentBuilder,
    MessageFlags,
    StringSelectMenuBuilder
} from 'discord.js'
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { config } from '../../const';
import { client } from '../../structures/client';
import { ButtonTypes, RunOptions } from '../../types/command';
import { BroadcastRecord } from '../../structures/types';

const logger = new Logger('RemoveServerCmd');

export default new Command({
    name: 'remove-server',
    description: "Used for removing servers/webhooks from the network.",
    options:[],

    run: async (options) => {
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }
        const mainGuild = client.guilds.cache.get(config.mainServerId);
        if(!mainGuild) {
            logger.warn('Could not get main server.');
            return;
        }
        const guildUser = mainGuild.members.cache.get(options.interaction.user.id);
        if(!guildUser) {
            await options.interaction.reply({ content: `You do not have permission to use this!`, ephemeral: true });
            return;
        }
        if(!guildUser.roles.cache.has(config.navigatorRoleId)) {
            await options.interaction.reply({ content: `You do not have permission to use this!`, ephemeral: true });
            return;
        }

        let selectedServerId = "";
        let broadcasts = await databaseManager.getBroadcasts();
        let segmentedServerListEmbedFields = await buildList(broadcasts);
        let serverSelection = await buildServerSelectionMessage(segmentedServerListEmbedFields[0], options.interaction.user.id, segmentedServerListEmbedFields.length, 1);
        
        const firstReply = await options.interaction.reply({embeds: [serverSelection.embed], components: serverSelection.components, flags: MessageFlags.Ephemeral})
        const filter = (i : Interaction) => {
            return i.user.id === options.interaction.user.id;
        }
        const serverSelectionCollector = firstReply.createMessageComponentCollector({ filter });
        serverSelectionCollector.on('collect', async (componentInteraction) => {
            switch(componentInteraction.componentType) {
                case ComponentType.Button:
                    const componentInteractionCustomIdArgs = componentInteraction.customId.split(/ +/);
                    if(componentInteractionCustomIdArgs.length < 2) {
                        logger.warn('Got less than 2 arguments for component interaction custom id.');
                        return;
                    }
                    const buttonType = componentInteractionCustomIdArgs[1];
                    switch(buttonType) {
                        case ButtonTypes.BACK:
                            serverSelection = await buildServerSelectionMessage(segmentedServerListEmbedFields[parseInt(componentInteractionCustomIdArgs[2])-1], options.interaction.user.id, segmentedServerListEmbedFields.length, parseInt(componentInteractionCustomIdArgs[2])-1);
                            firstReply.edit({embeds: [serverSelection.embed], components: serverSelection.components});
                            break;
                        case ButtonTypes.FORWARD:
                            serverSelection = await buildServerSelectionMessage(segmentedServerListEmbedFields[parseInt(componentInteractionCustomIdArgs[2])+1], options.interaction.user.id, segmentedServerListEmbedFields.length, parseInt(componentInteractionCustomIdArgs[2])+1);
                            firstReply.edit({embeds: [serverSelection.embed], components: serverSelection.components});
                            break;
                        case ButtonTypes.MENU_BACK:
                            broadcasts = await databaseManager.getBroadcasts();
                            segmentedServerListEmbedFields = await buildList(broadcasts);
                            serverSelection = await buildServerSelectionMessage(segmentedServerListEmbedFields[0], options.interaction.user.id, segmentedServerListEmbedFields.length, 1);
                            firstReply.edit({embeds: [serverSelection.embed], components: serverSelection.components});
                            break;
                        case ButtonTypes.REMOVE_SERVER:
                            try {
                                const guildToLeave = client.guilds.cache.get(componentInteractionCustomIdArgs[2]);
                                if(!guildToLeave) {
                                    await options.interaction.followUp({content: "Could not find server, contact Birb.", flags: MessageFlags.Ephemeral});
                                    return;
                                }
                                await Promise.allSettled((await guildToLeave.fetchWebhooks()).map(async (webhook) => {
                                    if(webhook.owner === options.client.user) {
                                        await databaseManager.deleteBroadcastByWebhookId(webhook.id);
                                        config.activeWebhooks.splice(config.activeWebhooks.findIndex((activeWebhook) => activeWebhook.id === webhook.id), 1);
                                        webhook.delete();
                                    }
                                }))
                                guildToLeave.leave();
                                await options.interaction.followUp({content: "Successfully left the server.", flags: MessageFlags.Ephemeral});
                            } catch(error) {
                                await options.interaction.followUp({content: "Could not leave server, contact Birb.", flags: MessageFlags.Ephemeral});
                                logger.error("Couldnt leave server", (error as Error));
                            }
                            broadcasts = await databaseManager.getBroadcasts();
                            segmentedServerListEmbedFields = await buildList(broadcasts);
                            serverSelection = await buildServerSelectionMessage(segmentedServerListEmbedFields[0], options.interaction.user.id, segmentedServerListEmbedFields.length, 1);
                            firstReply.edit({embeds: [serverSelection.embed], components: serverSelection.components});
                            break;
                        case ButtonTypes.WEBHOOK:
                            broadcasts = await databaseManager.getBroadcasts();
                            segmentedServerListEmbedFields = await buildList(broadcasts);
                            try {
                                const actionRows = await deleteWebhookButtonHandler(selectedServerId, componentInteractionCustomIdArgs[0], componentInteraction);
                                firstReply.edit({components: actionRows});
                            } catch(error) {
                                firstReply.edit({content: "Got an error during the process, contact Birb"});
                                logger.error("Got error while deleting webhook.", (error as Error));
                            }
                            break;
                    }
                    break;
                case ComponentType.StringSelect:
                    await componentInteraction.deferUpdate();
                    selectedServerId = componentInteraction.values[0];
                    try {
                        const serverRemovalUi = await buildServerRemovalUi(options, componentInteraction.values[0]);
                        firstReply.edit({embeds: [serverRemovalUi.embed], components: serverRemovalUi.components});
                    } catch(error) {
                        firstReply.edit({content: "Got an error during the process, contact Birb"});
                        logger.error("Got error during building server removal ui.", (error as Error));
                    }
                    break;
            }
        })
    }

});

const buildList = async (broadcasts: BroadcastRecord[]): Promise<({name: string, value: string})[][]> => {
    const serverListEmbedFields: ({name: string, value: string})[] = [];
    const serverListEmbedFieldsBlock: ({name: string, value: string})[] = [];
    const clientGuilds = await client.guilds.fetch();
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
    serverListEmbedFields.forEach((embedField, idx) => {
        if(idx%config.embedFieldLimit == 0 && idx != 0) {
            segmentedServerListEmbedFields.push(serverListEmbedFieldsBlock);
            serverListEmbedFieldsBlock.length = 0;
        }
        serverListEmbedFieldsBlock.push(embedField);
    })
    if(serverListEmbedFieldsBlock.length) {
        segmentedServerListEmbedFields.push(serverListEmbedFieldsBlock);
    }
    return segmentedServerListEmbedFields;
}

const buildServerSelectionMessage = async (list: ({name: string, value: string})[], interactionUserId: string, pages: number, currentPage: number): Promise<({embed: EmbedBuilder, components: ActionRowBuilder<MessageActionRowComponentBuilder>[]})> => {
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

const buildServerRemovalUi = async (options: RunOptions, selectedServerId: string): Promise<({embed: EmbedBuilder, components: ActionRowBuilder<MessageActionRowComponentBuilder>[]})> => {
    const selectedServer = client.guilds.cache.get(selectedServerId);
    if(!selectedServer) {
        await options.interaction.followUp({ content: 'Could not find the server, please verify that the bot is on it, if it is dm Birb.', ephemeral: true });
        throw new Error('Could not find selected server.');
    }
    
    const serverAeonWebhooks = config.activeWebhooks.filter((webhook) => webhook.guildId === selectedServer.id);

    const webhookButtons = new ActionRowBuilder<ButtonBuilder>();
    await Promise.allSettled(serverAeonWebhooks.map(async (aeonWebhook) => {
        const broadcast = await databaseManager.getBroadcastByWebhookId(aeonWebhook.id);
        if(!broadcast) return;
        const button = new ButtonBuilder()
            .setCustomId(`${aeonWebhook.id} ${ButtonTypes.WEBHOOK}`)
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

const deleteWebhookButtonHandler = async (serverId: string, selectedWebhookId: string, componentInteraction: ButtonInteraction<CacheType>): Promise<ActionRowBuilder<MessageActionRowComponentBuilder>[]> => {
    
    const serverAeonWebhooks = config.activeWebhooks.filter((activeWebhook) => activeWebhook.guildId === serverId);
    const selectedWebhook = serverAeonWebhooks.find((webhook) => webhook.id === selectedWebhookId);
    if(!selectedWebhook) {
        throw new Error('Could not find webhook.');
    }
    const selectedWebhookPosition = config.activeWebhooks.findIndex((webhook) => webhook === selectedWebhook);
    try {
        config.activeWebhooks.splice(selectedWebhookPosition);
        await selectedWebhook.delete();
        await databaseManager.deleteBroadcastByWebhookId(selectedWebhookId);
    } catch(error) {
        logger.error('Could not delete webhook.', (error as Error));
        await componentInteraction.deferUpdate();
        await componentInteraction.followUp({content: 'Could not delete webhook.', flags: "Ephemeral"});
    }

    const message = componentInteraction.message;
    const webhookButtonsRow = new ActionRowBuilder<ButtonBuilder>();
    const removeServerButtonRow = new ActionRowBuilder<ButtonBuilder>();
    const backToMenuButtonRow = new ActionRowBuilder<ButtonBuilder>();
    message.components.forEach((row) => {
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