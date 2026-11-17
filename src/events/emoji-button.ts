import { ButtonComponent } from "discord.js";
import { Event } from "../structures/event";
import { Logger } from "../logger";
import { config } from "../const";
import { clients } from "../structures/client";
import { ErrorNames } from "../types/error-handler";
import { emojiButton } from "../functions/buttons/emoji";

export const logger = new Logger("Buttons");

// TODO: test
export default new Event("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    await interaction.deferUpdate();
    if(config.botStarting) return;
    const guildId = interaction.guildId;
    if(!guildId) return;
    const client = clients.find((client) => client.guilds.cache.has(guildId));
    if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);
    
    const buttonComponent = (interaction.component as ButtonComponent);
    if(!buttonComponent) throw new Error(ErrorNames.NO_BUTTON_COMPONENT);
    const buttonCustomId = buttonComponent.customId;
    if (!buttonCustomId) throw new Error(ErrorNames.NO_BUTTON_ID);
    if (!interaction.channel) throw new Error(ErrorNames.NO_CHANNEL);

    const customEmojiRegex = new RegExp(/.*:[0-9]*/gm);
    const standardEmojiRegex = new RegExp(/%[A-Z0-9][A-Z0-9]/gm);

    if (!!buttonCustomId.match(customEmojiRegex) || !!buttonCustomId.match(standardEmojiRegex)) {
        await emojiButton(client, interaction);
    }
})