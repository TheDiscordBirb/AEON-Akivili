import { Command } from '../../structures/command';
import { 
    ActionRowBuilder,
    ButtonBuilder, 
    ButtonStyle, 
    Colors, 
    EmbedBuilder,
    Guild,
    MessageActionRowComponentBuilder,
    PermissionFlagsBits
} from 'discord.js'
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { BanshareListData } from '../../types/database';
import { ButtonTypes, RunOptions } from '../../types/command';
import { config } from '../../const';
import { StringSelectMenuBuilder } from '@discordjs/builders';
import { BanshareStatus } from '../../types/event';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { errorHandler } from '../../structures/error-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { banshareListButtons } from '../../functions/buttons';

const logger = new Logger('BanshareListCmd');


// TODO: test
export const banshareListChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);

    const guildMember = options.interaction.guild.members.cache.get(options.interaction.member.user.id);
    
    if (!guildMember) throw new Error(ErrorNames.NO_GUILD_MEMBER);

    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: false},
        options.interaction.guild,
        [PermissionFlagsBits.BanMembers],
        PermissionLevels.NAVIGATOR);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral"});
        throw new Error(ErrorNames.NO_PERMISSIONS);
    }

    if (!options.interaction.channel) throw new Error(ErrorNames.NO_INTERACTION_CHANNEL);
    
    const unsortedBanshares = await databaseManager.getBanshareList(options.interaction.guild?.id);

    await banshareListCommand(
        options,
        unsortedBanshares, 
        options.interaction.guild
    );
}

export default new Command({
    name: 'banshare-list',
    description: "Displays every banshare and their status.",
    options:
    [],

    run: async (options) => {
        try {
            await banshareListChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user, 
                interactionType: InteractionTypes.BANSHARE_LIST
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);
        }
    }
});

export const banshareListCommand = async (
    options: RunOptions,
    unsortedBanshares: BanshareListData[],
    guild: Guild
) => {
    const sortedBanshares : BanshareListData[][] = [];
    const sortedBanshareBlock : BanshareListData[] = [];
    
    unsortedBanshares.forEach((banshareData, idx) => {
        if(idx%config.embedFieldLimit == 0 && idx != 0) {
            sortedBanshares.push(sortedBanshareBlock);
            sortedBanshareBlock.length = 0;
        }
        sortedBanshareBlock.push(banshareData);
    });
    
    if(sortedBanshareBlock.length) {
        sortedBanshares.push(sortedBanshareBlock);
    }

    const banshareListEmbedButtonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
    const filterSelectorActionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
    let actionRows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

    const backButton = new ButtonBuilder()
        .setEmoji('⬅️')
        .setCustomId(`${options.interaction.user.id} ${ButtonTypes.BACK} 0`)
        .setDisabled(true)
        .setStyle(ButtonStyle.Secondary)

    const forwardButton = new ButtonBuilder()
        .setEmoji('➡️')
        .setCustomId(`${options.interaction.user.id} ${ButtonTypes.FORWARD} 0`)
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
        .setTitle(`${guild.name} banshares`)
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
        await options.interaction.reply({embeds: [banshareListEmbed], components: actionRows, flags: 'Ephemeral'});
        return;
    }

    sortedBanshares[0].forEach((banshare) => {
        banshareListEmbed.addFields({name: `${banshare.userId}${config.mainServerId === options.interaction.guildId ? "" : ` | ${banshare.status}`}`, value: `Reason: ${banshare.reason}\nProof:\n${banshare.proof}\nTimestamp: ${new Date(banshare.timestamp).getFullYear()}.${new Date(banshare.timestamp).getMonth() + 1}.${new Date(banshare.timestamp).getDate()}. ${new Date(banshare.timestamp).getHours()}:${new Date(banshare.timestamp).getMinutes()}:${new Date(banshare.timestamp).getSeconds()}`});
    });

    if(sortedBanshares.length == 1) {
        forwardButton.setDisabled(true);
        banshareListEmbedButtonRow.components.length = 0;
        banshareListEmbedButtonRow.addComponents([backButton, forwardButton]);
    }

    actionRows.length = 0;
    if(options.interaction.guildId != config.mainServerId) {
        actionRows.push(filterSelectorActionRow)
    }
    actionRows.push(banshareListEmbedButtonRow);
    const collector = (await options.interaction.reply({embeds: [banshareListEmbed], components: actionRows, flags: 'Ephemeral'})).createMessageComponentCollector();
    collector.on('collect', async (componentInteraction) => {
        if(componentInteraction.isButton() || componentInteraction.isStringSelectMenu()) {
            await banshareListButtons(
                componentInteraction,
                options,
                sortedBanshares,
                banshareListEmbed,
                backButton,
                forwardButton,
                banshareListEmbedButtonRow,
                filterSelectorActionRow,
                actionRows,
                sortedBanshareBlock,
                unsortedBanshares
            )
        }
    });   

}