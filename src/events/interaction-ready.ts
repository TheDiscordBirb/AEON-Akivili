import { CommandInteractionOptionResolver } from "discord.js";
import { client } from "../structures/client";
import { Event } from "../structures/event";
import { ExtendedInteraction } from "../types/command";

export default new Event("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command)
            return interaction.followUp("You have used a non existent command");

        command.run({
            args: interaction.options as CommandInteractionOptionResolver,
            client,
            interaction: interaction as ExtendedInteraction
        });
    }
});