import { Command } from '../../structures/command';
import { 
    ActionRowBuilder,
    APIEmbedField,
    ButtonBuilder, 
    ButtonStyle, 
    Colors, 
    EmbedBuilder,
    ComponentType,
    MessageActionRowComponentBuilder
} from 'discord.js'
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { BanshareListData } from '../../types/database';
import { BanshareButtonInstructions } from '../../types/command';
import { config } from '../../const';
import { StringSelectMenuBuilder } from '@discordjs/builders';
import { BanshareStatus } from '../../types/event';
import { hasModerationRights } from '../../utils';

const logger = new Logger('BanshareListCmd');

export default new Command({
    name: 'banshare-list',
    description: "Displays every banshare and their status.",
    options:
    [],

    run: async (options) => {
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }

        const guildMember = options.interaction.guild.members.cache.get(options.interaction.member.user.id);
        
        if (!guildMember) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }

        if(!hasModerationRights(guildMember)) {
            await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
            return;
        }

        if (!options.interaction.channel) {
            logger.wtf(`${options.interaction.member.user.username} has used a command without a channel.`);
            return;
        }
        
        let unsortedBanshares : BanshareListData[] = [];
        try {
            unsortedBanshares = await databaseManager.getBanshareList(options.interaction.guild?.id);
        } catch(error) {
            logger.error("Error", (error as Error));
        }
        const sortedBanshares : BanshareListData[][] = [];
        const sortedBanshareBlock : BanshareListData[] = [];
        

        unsortedBanshares.forEach((banshareData, idx) => {
            if(idx%config.embedFieldLimit == 0 && idx != 0) {
                sortedBanshares.push(sortedBanshareBlock);
                sortedBanshareBlock.length = 0;
            }
            sortedBanshareBlock.push(banshareData);
        })
        if(sortedBanshareBlock.length) {
            sortedBanshares.push(sortedBanshareBlock);
        }

        const banshareListEmbedButtonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
        const filterSelectorActionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
        let actionRows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

        const backButton = new ButtonBuilder()
            .setEmoji('⬅️')
            .setCustomId(`${options.interaction.user.id} ${BanshareButtonInstructions.BACK} 0`)
            .setDisabled(true)
            .setStyle(ButtonStyle.Secondary)

        const forwardButton = new ButtonBuilder()
            .setEmoji('➡️')
            .setCustomId(`${options.interaction.user.id} ${BanshareButtonInstructions.FORWARD} 0`)
            .setStyle(ButtonStyle.Secondary)

        const filterSelector = new StringSelectMenuBuilder()
            .setCustomId(`${options.interaction.user.id} selector`)
            .setPlaceholder("Select a filter.")
            .setOptions(
                {label: "All", value: "all"},
                {label: "Pending", value: BanshareStatus.PENDING},
                {label: "Enforced", value: BanshareStatus.ENFORCED},
                {label: "Rejected", value: BanshareStatus.REJECTED},
                {label: "Overturned", value: BanshareStatus.OVERTURNED}
            )

        filterSelectorActionRow.addComponents([filterSelector]);
        banshareListEmbedButtonRow.addComponents([backButton, forwardButton]);

        const banshareListEmbed = new EmbedBuilder()
            .setTitle(`${options.interaction.guild.name} banshares`)
            .setDescription("Found the following banshares:")
            .setColor(Colors.DarkGold)
        
        if(!unsortedBanshares.length) {
            banshareListEmbed.setDescription("No banshares found.");
            forwardButton.setDisabled(true);
            filterSelector.setDisabled(true);
            banshareListEmbedButtonRow.components.length = 0;
            banshareListEmbedButtonRow.addComponents([backButton, forwardButton]);
            if(options.interaction.guildId != config.mainServerId) {
                actionRows.push(filterSelectorActionRow)
            }
            actionRows.push(banshareListEmbedButtonRow);
            await options.interaction.reply({embeds: [banshareListEmbed], components: actionRows, ephemeral: true});
            return;
        }

        sortedBanshares[0].forEach((banshare) => {
            banshareListEmbed.addFields({name: `${banshare.userId}${config.mainServerId === options.interaction.guildId ? "" : ` | ${banshare.status}`}`, value: `Reason: ${banshare.reason.slice(0, 228)}\nTimestamp: ${new Date(banshare.timestamp).getFullYear()}.${new Date(banshare.timestamp).getMonth() + 1}.${new Date(banshare.timestamp).getDate()}. ${new Date(banshare.timestamp).getHours()}:${new Date(banshare.timestamp).getMinutes()}:${new Date(banshare.timestamp).getSeconds()}`});
        });

        try {
            sortedBanshares[1].length;
        } catch(error) {
            forwardButton.setDisabled(true);
            banshareListEmbedButtonRow.components.length = 0;
            banshareListEmbedButtonRow.addComponents([backButton, forwardButton]);
        }

        actionRows.length = 0;
        if(options.interaction.guildId != config.mainServerId) {
            actionRows.push(filterSelectorActionRow)
        }
        actionRows.push(banshareListEmbedButtonRow);
        const collector = (await options.interaction.reply({embeds: [banshareListEmbed], components: actionRows, ephemeral: true})).createMessageComponentCollector();
        collector.on('collect', async (componentInteraction) => {
            switch(componentInteraction.componentType) {
                case ComponentType.Button:
                    const fields : APIEmbedField[] = [];
                    const currentPage = parseInt(componentInteraction.customId.split(/ +/)[2]);
                    const pageInstruction = componentInteraction.customId.split(/ +/)[1] === BanshareButtonInstructions.BACK ? 0 : 1;
                    sortedBanshares[currentPage+(pageInstruction ? 1 : -1)].forEach((banshare) => {
                        fields.push({name: `${banshare.userId} | ${banshare.status}`, value: `Reason: ${banshare.reason.slice(0, 228)}\nTimestamp: ${new Date(banshare.timestamp).getFullYear()}.${new Date(banshare.timestamp).getMonth() + 1}.${new Date(banshare.timestamp).getDate()}. ${new Date(banshare.timestamp).getHours()}:${new Date(banshare.timestamp).getMinutes()}:${new Date(banshare.timestamp).getSeconds()}`})
                    })
                    banshareListEmbed.setFields(fields);
                    backButton.setCustomId(`${options.interaction.user.id} 0 ${currentPage+(pageInstruction ? 1 : -1)}`);
                    forwardButton.setCustomId(`${options.interaction.user.id} 1 ${currentPage+(pageInstruction ? 1 : -1)}`);
        
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
                            banshareListEmbed.addFields({name: `${banshare.userId}${config.mainServerId === options.interaction.guildId ? "" : ` | ${banshare.status}`}`, value: `Reason: ${banshare.reason.slice(0, 228)}\nTimestamp: ${new Date(banshare.timestamp).getFullYear()}.${new Date(banshare.timestamp).getMonth() + 1}.${new Date(banshare.timestamp).getDate()}. ${new Date(banshare.timestamp).getHours()}:${new Date(banshare.timestamp).getMinutes()}:${new Date(banshare.timestamp).getSeconds()}`});
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
                    
                    backButton.setCustomId(`${options.interaction.user.id} ${BanshareButtonInstructions.BACK} 0`);
                    backButton.setDisabled(true);
                    forwardButton.setCustomId(`${options.interaction.user.id} ${BanshareButtonInstructions.FORWARD} 0`);
                    
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
        });   
    }
})