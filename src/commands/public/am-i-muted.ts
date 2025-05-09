import { Command } from "../../structures/command"; 
import { Logger } from "../../logger";
import { databaseManager } from "../../structures/database";

const logger = new Logger('AmIMutedCmd');

export default new Command({
    name: 'am-i-muted',
    description: 'Used for checking if you are muted.',
    options: [],

    run: async (options) => {
        const isUserMuted = await databaseManager.hasUserBeenMutedOnNetworkChat(options.interaction.user.id);
        await options.interaction.reply({ content: isUserMuted ? "Yes" : "No", ephemeral: true });
    }
})