import { ButtonComponent, StringSelectMenuComponent } from "discord.js";
import { Event } from "../structures/event";
import { Logger } from "../logger";
import { config } from "../const";
import { clients } from "../structures/client";
import { ErrorNames } from "../types/error-handler";
import { emojiButton } from "../functions/buttons/emoji";
import { ButtonIds } from "../types/buttons";
import { banshareButtons } from "../functions/buttons/banshare";
import { dmButtons } from "../functions/buttons/dm";
import { joinNetworkButtons } from "../functions/buttons/join-network";
import { modmailCloseButton } from "../functions/buttons/modmail";

export const logger = new Logger("Buttons");

// TODO: test
export default new Event("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if(config.botStarting) return;
    const client = clients.find((client) => client.channels.fetch(interaction.channelId));
    if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);
    
    const buttonComponent = (interaction.component as ButtonComponent | StringSelectMenuComponent);
    if(!buttonComponent) throw new Error(ErrorNames.NO_BUTTON_COMPONENT);
    const buttonCustomId = buttonComponent.customId;
    if (!buttonCustomId) throw new Error(ErrorNames.NO_BUTTON_ID);
    if (!interaction.channel) throw new Error(ErrorNames.NO_CHANNEL);

    switch(buttonCustomId.split(/ /)[0]) {
        case ButtonIds.BANSHARE: {
            const guildMember = await interaction.guild?.members.fetch(interaction.user.id);
            if(!guildMember) throw new Error(ErrorNames.NO_GUILD_MEMBER);
            await banshareButtons(client, interaction, guildMember)
            break;
        }
        case ButtonIds.BANSHARE_LIST: {
            break;
        }
        case ButtonIds.DM: {
            await dmButtons(interaction);
            break;
        }
        case ButtonIds.EMOJI: {
            await emojiButton(client, interaction);
            break;
        }
        case ButtonIds.JOIN_NETWORK: {
            await joinNetworkButtons(interaction);
            break;
        }
        case ButtonIds.MODMAIL: {
            await modmailCloseButton(interaction)
            break;
        }
        case ButtonIds.REMOVE_SERVER: {
            break;
        }
        default: {
            return;
        }
    }
})