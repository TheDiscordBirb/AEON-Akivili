import { 
    ActionRowBuilder,
    APIEmbedField, 
    ButtonBuilder, 
    ButtonInteraction, 
    ButtonStyle, 
    CacheType, 
    Client, 
    ComponentType, 
    EmbedBuilder, 
    InteractionResponse, 
    MessageActionRowComponentBuilder, 
    MessageFlags, 
    StringSelectMenuInteraction, 
    TextChannel 
} from "discord.js";
import { JoinRequestButtonArg } from "../types/event";
import { clients } from "../structures/client";
import { joinHandler } from "./join-handler";
import { errorButtonFunction } from "../events/buttons";
import { ButtonTypes, RunOptions } from "../types/command";
import { BanshareListRecord, BroadcastRecord } from "../types/database";
import { config } from "../const";
import { buildList, buildServerRemovalUi, buildServerSelectionMessage, deleteWebhookButtonHandler } from "../commands/navigator/remove-server";
import { databaseManager } from "../structures/database";
import { ErrorNames } from "../types/error-handler";

export const joinNetworkButtons = async (interaction: ButtonInteraction<"cached">) => {
    const customIdArgs = interaction.customId.split(" ");
    const command = customIdArgs.shift();
    if(!(command === JoinRequestButtonArg.ACCEPT_REQUEST || command === JoinRequestButtonArg.REJECT_REQUEST)) {
        throw new Error("Got invalid button custom id.");
    }
    const guildId = customIdArgs[0];
    const channelId = customIdArgs[1];
    const type = customIdArgs[2];
    
    const client = clients.find((client) => client.guilds.cache.has(guildId));
    if(!client) {
        throw new Error("Could not get client.");
    }
    const guild = client.guilds.cache.find((guild) => guild.id === guildId);
    if (!guild) {
        throw new Error('No guild found while trying to accept a request.')
    }

    const channel = guild.channels.cache.find((channel) => channel.id === channelId);
    if (!channel) {
        throw new Error('No channel found while trying to accept a request.')
    }
    try {
        if(command === JoinRequestButtonArg.ACCEPT_REQUEST) {
            await joinHandler.acceptNetworkAccessRequest(
                { 
                    guild, 
                    channel: channel as TextChannel, 
                    type, 
                    user: client.users.cache.get(interaction.message.embeds[0]
                        .description?.split(/ +/)[interaction.message.embeds[0]
                        .description?.split(/ +/).length - 1] ?? interaction.user.id) ?? interaction.user 
                });
        } else {
            await joinHandler.rejectNetworkAccessRequest(
                { 
                    guild, 
                    channel: channel as TextChannel, 
                    type, 
                    user: client.users.cache.get(interaction.message.embeds[0]
                        .description?.split(/ +/)[interaction.message.embeds[0]
                        .description?.split(/ +/).length - 1] ?? interaction.user.id) ?? interaction.user 
                });
        }
    } catch (error) {
        await errorButtonFunction(interaction as ButtonInteraction);
        throw error;
    }

    const joinHandlerActionRow = new ActionRowBuilder<ButtonBuilder>();

    const acceptButton = new ButtonBuilder()
        .setCustomId(interaction.customId)
        .setLabel('Accepted')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
        
    const rejectButton = new ButtonBuilder()
        .setCustomId(interaction.customId)
        .setLabel('Rejected')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true)

    joinHandlerActionRow.addComponents(command === JoinRequestButtonArg.ACCEPT_REQUEST ? acceptButton : rejectButton);

    await interaction.message.edit({ components: [joinHandlerActionRow] });
}

export const banshareListButtons = async (
    componentInteraction: ButtonInteraction<CacheType> | StringSelectMenuInteraction<CacheType>,
    options: RunOptions,
    sortedBanshares: BanshareListRecord[][],
    banshareListEmbed: EmbedBuilder,
    backButton: ButtonBuilder,
    forwardButton: ButtonBuilder,
    banshareListEmbedButtonRow: ActionRowBuilder<MessageActionRowComponentBuilder>,
    filterSelectorActionRow: ActionRowBuilder<MessageActionRowComponentBuilder>,
    actionRows: ActionRowBuilder<MessageActionRowComponentBuilder>[],
    sortedBanshareBlock: BanshareListRecord[],
    unsortedBanshares: BanshareListRecord[]
) => {
    switch(componentInteraction.componentType) {
        case ComponentType.Button:
            const fields : APIEmbedField[] = [];
            const currentPage = parseInt(componentInteraction.customId.split(/ +/)[2]);
            const pageInstruction = componentInteraction.customId.split(/ +/)[1] === ButtonTypes.BACK ? 0 : 1;
            sortedBanshares[currentPage+(pageInstruction ? 1 : -1)].forEach((banshare) => {
                fields.push({name: `${banshare.userId} | ${banshare.status}`, value: `Reason: ${banshare.reason}\nProof:\n${banshare.proof}\nTimestamp: ${new Date(banshare.timestamp).getFullYear()}.${new Date(banshare.timestamp).getMonth() + 1}.${new Date(banshare.timestamp).getDate()}. ${new Date(banshare.timestamp).getHours()}:${new Date(banshare.timestamp).getMinutes()}:${new Date(banshare.timestamp).getSeconds()}`})
            })
            banshareListEmbed.setFields(fields);
            backButton.setCustomId(`${options.interaction.user.id} ${ButtonTypes.BACK} ${currentPage+(pageInstruction ? 1 : -1)}`);
            forwardButton.setCustomId(`${options.interaction.user.id} ${ButtonTypes.FORWARD} ${currentPage+(pageInstruction ? 1 : -1)}`);

            try {
                sortedBanshares[currentPage+(pageInstruction ? 1 : -1) - 1]
            } catch(error) {
                backButton.setDisabled(true);
            }

            try {
                sortedBanshares[currentPage+(pageInstruction ? 1 : -1) + 1]
            } catch(error) {
                forwardButton.setDisabled(true);
            }
            
            banshareListEmbedButtonRow.components.length = 0;
            banshareListEmbedButtonRow.addComponents([backButton, forwardButton]);
            
            actionRows.length = 0;
            if(options.interaction.guildId != config.mainServerId) {
                actionRows.push(filterSelectorActionRow)
            }
            actionRows.push(banshareListEmbedButtonRow);
            await options.interaction.editReply({embeds: [banshareListEmbed], components: actionRows});
            break;
        case ComponentType.StringSelect:
            await componentInteraction.deferUpdate();
            sortedBanshares.length = 0;
            sortedBanshareBlock.length = 0;
            
            unsortedBanshares.forEach((banshareData, idx) => {
                if(componentInteraction.values[0] === 'all' || componentInteraction.values[0] === banshareData.status) {
                    if(idx%config.embedFieldLimit == 0 && idx != 0) {
                        sortedBanshares.push(sortedBanshareBlock);
                        sortedBanshareBlock.length = 0;
                    }
                    sortedBanshareBlock.push(banshareData);
                }
            })
            if(sortedBanshareBlock.length) {
                sortedBanshares.push(sortedBanshareBlock);
            }
            banshareListEmbed.setFields();

            try {
                sortedBanshares[0].forEach((banshare) => {
                    banshareListEmbed.addFields({name: `${banshare.userId}${config.mainServerId === options.interaction.guildId ? "" : ` | ${banshare.status}`}`, value: `Reason: ${banshare.reason}\nProof:${banshare.proof}\nTimestamp: ${new Date(banshare.timestamp).getFullYear()}.${new Date(banshare.timestamp).getMonth() + 1}.${new Date(banshare.timestamp).getDate()}. ${new Date(banshare.timestamp).getHours()}:${new Date(banshare.timestamp).getMinutes()}:${new Date(banshare.timestamp).getSeconds()}`});
                });
                banshareListEmbed.setDescription("Found the following banshares:");
            } catch (error) {
                banshareListEmbed.setDescription("No banshares found.");
                forwardButton.setDisabled(true);
                banshareListEmbedButtonRow.components.length = 0;
                banshareListEmbedButtonRow.addComponents([backButton, forwardButton]);
                actionRows.length = 0;
                if(options.interaction.guildId != config.mainServerId) {
                    actionRows.push(filterSelectorActionRow)
                }
                actionRows.push(banshareListEmbedButtonRow);
                await options.interaction.editReply({embeds: [banshareListEmbed], components: actionRows});
                return;
            }
            
            backButton.setCustomId(`${options.interaction.user.id} ${ButtonTypes.BACK} 0`);
            backButton.setDisabled(true);
            forwardButton.setCustomId(`${options.interaction.user.id} ${ButtonTypes.FORWARD} 0`);
            
            try {
                sortedBanshares[1].length;
            } catch(error) {
                forwardButton.setDisabled(true);
                banshareListEmbedButtonRow.components.length = 0;
            }
            banshareListEmbedButtonRow.addComponents([backButton, forwardButton]);
            actionRows.length = 0;
            if(options.interaction.guildId != config.mainServerId) {
                actionRows.push(filterSelectorActionRow)
            }
            actionRows.push(banshareListEmbedButtonRow);

            await options.interaction.editReply({embeds: [banshareListEmbed], components: actionRows});
            break;
    }
}

export const removeServerButtons = async (
    componentInteraction: StringSelectMenuInteraction<CacheType> | ButtonInteraction<CacheType>,
    serverSelection: {
        embed: EmbedBuilder,
        components: ActionRowBuilder<MessageActionRowComponentBuilder>[]
    },
    segmentedServerListEmbedFields: { name: string, value: string }[][],
    options: RunOptions,
    firstReply: InteractionResponse<boolean>,
) => {
    const broadcasts = await databaseManager.getBroadcasts();
    await componentInteraction.deferUpdate();
    switch(componentInteraction.componentType) {
        case ComponentType.Button:
            const componentInteractionCustomIdArgs = componentInteraction.customId.split(/ +/);
            if(componentInteractionCustomIdArgs.length < 2) {
                throw new Error('Got less than 2 arguments for component interaction custom id.');
            }
            const buttonType = componentInteractionCustomIdArgs[1];
            const selectedServerId = componentInteractionCustomIdArgs[2];
            switch(buttonType) {
                case ButtonTypes.BACK:
                    serverSelection = await buildServerSelectionMessage(
                        segmentedServerListEmbedFields[parseInt(componentInteractionCustomIdArgs[2])-2], 
                        options.interaction.user.id, 
                        segmentedServerListEmbedFields.length, 
                        parseInt(componentInteractionCustomIdArgs[2])-1
                    );
                    firstReply.edit({ embeds: [serverSelection.embed], components: serverSelection.components });
                    break;
                case ButtonTypes.FORWARD:
                    serverSelection = await buildServerSelectionMessage(
                        segmentedServerListEmbedFields[parseInt(componentInteractionCustomIdArgs[2])], 
                        options.interaction.user.id, 
                        segmentedServerListEmbedFields.length, 
                        parseInt(componentInteractionCustomIdArgs[2])+1
                    );
                    firstReply.edit({ embeds: [serverSelection.embed], components: serverSelection.components });
                    break;
                case ButtonTypes.MENU_BACK:
                    segmentedServerListEmbedFields = await buildList(broadcasts);
                    serverSelection = await buildServerSelectionMessage(
                        segmentedServerListEmbedFields[0], 
                        options.interaction.user.id, 
                        segmentedServerListEmbedFields.length, 
                        1
                    );
                    firstReply.edit({ embeds: [serverSelection.embed], components: serverSelection.components });
                    break;
                case ButtonTypes.REMOVE_SERVER:
                    const removedServerClient = clients.find((c) => c.guilds.cache.has(selectedServerId));
                    if(!removedServerClient) throw new Error(ErrorNames.NO_CLIENT_IN_SERVER);
                    const guildToLeave = removedServerClient.guilds.cache.get(selectedServerId);
                    if(!guildToLeave) throw new Error(ErrorNames.NO_GUILD);

                    await Promise.allSettled((await guildToLeave.fetchWebhooks()).map(async (webhook) => {
                        if(webhook.owner === removedServerClient.user) {
                            await databaseManager.deleteBroadcastByWebhookId(webhook.id);
                            config.activeWebhooks.splice(
                                config.activeWebhooks.findIndex((activeWebhook) => activeWebhook.id === webhook.id),
                                1
                            );
                            await removedServerClient.deleteWebhook(webhook.id);
                        }
                    }));
                    await guildToLeave.leave();

                    await options.interaction.followUp({content: "Successfully left the server.", flags: MessageFlags.Ephemeral});
                    segmentedServerListEmbedFields = await buildList(broadcasts);
                    serverSelection = await buildServerSelectionMessage(
                        segmentedServerListEmbedFields[0], 
                        options.interaction.user.id, 
                        segmentedServerListEmbedFields.length, 
                        1
                    );
                    firstReply.edit({embeds: [serverSelection.embed], components: serverSelection.components});
                    break;
                case ButtonTypes.WEBHOOK:
                    segmentedServerListEmbedFields = await buildList(broadcasts);
                        const actionRows = await deleteWebhookButtonHandler(
                            selectedServerId, 
                            componentInteractionCustomIdArgs[0], 
                            componentInteraction
                        );
                        firstReply.edit({components: actionRows});
                    break;
            }
            break;
        case ComponentType.StringSelect:
            const serverRemovalUi = await buildServerRemovalUi(options, componentInteraction.values[0]);
            firstReply.edit({embeds: [serverRemovalUi.embed], components: serverRemovalUi.components});
            break;
    }
}