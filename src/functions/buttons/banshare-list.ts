import { 
    ActionRowBuilder,
    APIEmbedField, 
    ButtonBuilder, 
    ButtonInteraction, 
    CacheType, 
    ComponentType, 
    EmbedBuilder, 
    MessageActionRowComponentBuilder, 
    StringSelectMenuInteraction
} from "discord.js";
import { ButtonTypes, RunOptions } from "../../types/command";
import { BanshareListRecord } from "../../types/database";
import { config } from "../../const";
import { ButtonIds } from "../../types/buttons";

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
    await componentInteraction.deferUpdate();
    switch(componentInteraction.componentType) {
        case ComponentType.Button:
            const fields : APIEmbedField[] = [];
            const currentPage = parseInt(componentInteraction.customId.split(/ +/)[3]);
            const pageInstruction = componentInteraction.customId.split(/ +/)[2] === ButtonTypes.BACK ? 0 : 1;
            sortedBanshares[currentPage+(pageInstruction ? 1 : -1)].forEach((banshare) => {
                fields.push({name: `${banshare.userId} | ${banshare.status}`, value: `Reason: ${banshare.reason}\nProof:\n${banshare.proof}\nTimestamp: ${new Date(banshare.timestamp).getFullYear()}.${new Date(banshare.timestamp).getMonth() + 1}.${new Date(banshare.timestamp).getDate()}. ${new Date(banshare.timestamp).getHours()}:${new Date(banshare.timestamp).getMinutes()}:${new Date(banshare.timestamp).getSeconds()}`})
            })
            banshareListEmbed.setFields(fields);
            backButton.setCustomId(`${ButtonIds.BANSHARE_LIST} ${componentInteraction.user.id} ${ButtonTypes.BACK} ${currentPage+(pageInstruction ? 1 : -1)}`);
            forwardButton.setCustomId(`${ButtonIds.BANSHARE_LIST} ${componentInteraction.user.id} ${ButtonTypes.FORWARD} ${currentPage+(pageInstruction ? 1 : -1)}`);

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
            if(componentInteraction.guildId != config.mainServerId) {
                actionRows.push(filterSelectorActionRow)
            }
            actionRows.push(banshareListEmbedButtonRow);
            await options.interaction.editReply({embeds: [banshareListEmbed], components: actionRows});
            break;
        case ComponentType.StringSelect:
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
                if(componentInteraction.guildId != config.mainServerId) {
                    actionRows.push(filterSelectorActionRow)
                }
                actionRows.push(banshareListEmbedButtonRow);
                await options.interaction.editReply({embeds: [banshareListEmbed], components: actionRows});
                return;
            }
            
            backButton.setCustomId(`${ButtonIds.BANSHARE_LIST} ${componentInteraction.user.id} ${ButtonTypes.BACK} 0`);
            backButton.setDisabled(true);
            forwardButton.setCustomId(`${ButtonIds.BANSHARE_LIST} ${componentInteraction.user.id} ${ButtonTypes.FORWARD} 0`);
            
            try {
                sortedBanshares[1].length;
            } catch(error) {
                forwardButton.setDisabled(true);
                banshareListEmbedButtonRow.components.length = 0;
            }
            banshareListEmbedButtonRow.addComponents([backButton, forwardButton]);
            actionRows.length = 0;
            if(componentInteraction.guildId != config.mainServerId) {
                actionRows.push(filterSelectorActionRow)
            }
            actionRows.push(banshareListEmbedButtonRow);

            await options.interaction.editReply({embeds: [banshareListEmbed], components: actionRows});
            break;
    }
}