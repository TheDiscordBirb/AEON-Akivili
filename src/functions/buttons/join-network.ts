import { 
    ActionRowBuilder,
    ButtonBuilder, 
    ButtonInteraction, 
    CacheType, 
    TextChannel
} from "discord.js";
import { clients } from "../../structures/client";
import { ButtonStyle } from "discord-api-types/v10";
import { errorHandler } from "../../structures/error-handler";
import { ErrorNames, InteractionTypes } from "../../types/error-handler";
import { JoinRequestButtonArg } from "../../types/event";
import { joinHandler } from "../join-handler";

export const joinNetworkButtons = async (interaction: ButtonInteraction<CacheType>) => {
    await interaction.deferUpdate();
    const customIdArgs = interaction.customId.split(" ")
    customIdArgs.splice(0, 1);
    const command = customIdArgs.shift();
    if (!(command === JoinRequestButtonArg.ACCEPT_REQUEST || command === JoinRequestButtonArg.REJECT_REQUEST)) {
        throw new Error(ErrorNames.WRONG_BUTTON_ID);
    }
    const guildId = customIdArgs[0];
    const channelId = customIdArgs[1];
    const type = customIdArgs[2];

    const client = clients.find((client) => client.guilds.cache.has(guildId));
    if (!client) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);
    const guild = client.guilds.cache.find((guild) => guild.id === guildId);
    if (!guild) throw new Error(ErrorNames.NO_GUILD);

    const channel = guild.channels.cache.find((channel) => channel.id === channelId);
    if (!channel) throw new Error(ErrorNames.NO_CHANNEL);
    
    try {
        if (command === JoinRequestButtonArg.ACCEPT_REQUEST) {
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
        await errorHandler.showError({
            error: error as Error,
            user: interaction.user,
            interactionType: InteractionTypes.JOIN_NETWORK
        }, interaction.message);
    }

    const joinHandlerActionRow = new ActionRowBuilder<ButtonBuilder>();

    const acceptButton = new ButtonBuilder()
        .setCustomId(interaction.customId)
        .setLabel('Accepted')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true);

    const rejectButton = new ButtonBuilder()
        .setCustomId(interaction.customId)
        .setLabel('Rejected')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true);

    joinHandlerActionRow.addComponents(command === JoinRequestButtonArg.ACCEPT_REQUEST ? acceptButton : rejectButton);

    await interaction.message.edit({ components: [joinHandlerActionRow] });
};
