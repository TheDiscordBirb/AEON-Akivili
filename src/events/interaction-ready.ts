import { CacheType, ChatInputCommandInteraction, CommandInteractionOptionResolver, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction } from "discord.js";
import { clients } from "../structures/client";
import { Event } from "../structures/event";
import { ExtendedInteraction } from "../types/command";
import { config } from "../const";
import { Logger } from "../logger";

const logger = new Logger("InteractionReady");

export default new Event("interactionCreate", async (interaction) => {
    if(config.botStarting) return;
    const guildId = interaction.guildId;
    if(!guildId) return;
    const client = clients.find((client) => client.guilds.cache.has(guildId));
    if(!client) {
        logger.warn(`Could not get bot client for ${interaction.guildId}`);
        return;
    }
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command)
            return interaction.followUp("You have used a non existent command");

        command.run({
            args: (interaction as ChatInputCommandInteraction<CacheType> | MessageContextMenuCommandInteraction<CacheType> | UserContextMenuCommandInteraction<CacheType>).options as CommandInteractionOptionResolver,
            client,
            interaction: interaction as ExtendedInteraction
        });
    }
});