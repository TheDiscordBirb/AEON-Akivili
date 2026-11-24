import { 
    ActionRowBuilder,
    ButtonInteraction, 
    CacheType, 
    ComponentType, 
    EmbedBuilder, 
    InteractionResponse, 
    MessageActionRowComponentBuilder, 
    MessageFlags, 
    StringSelectMenuInteraction
} from "discord.js";
import { clients } from "../../structures/client";
import { ButtonTypes, RunOptions } from "../../types/command";
import { config } from "../../const";
import { 
    buildList, 
    buildServerRemovalUi, 
    buildServerSelectionMessage, 
    deleteWebhookButtonHandler 
} from "../../commands/navigator/remove-server";
import { databaseManager } from "../../structures/database";
import { ErrorNames } from "../../types/error-handler";

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
    await componentInteraction.deferUpdate();
    const broadcasts = await databaseManager.getBroadcasts();
    switch(componentInteraction.componentType) {
        case ComponentType.Button:
            const componentInteractionCustomIdArgs = componentInteraction.customId.split(/ +/)
            componentInteractionCustomIdArgs.splice(0, 1);
            if(componentInteractionCustomIdArgs.length < 2) throw new Error(ErrorNames.WRONG_BUTTON_ID);
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