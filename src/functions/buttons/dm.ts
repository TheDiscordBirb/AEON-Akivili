import { 
    ButtonInteraction, 
    CacheType, 
} from "discord.js";
import { DmMessageButtonArg } from "../../types/event";
import { databaseManager } from "../../structures/database";
import { ErrorNames } from "../../types/error-handler";
import { banshareManager } from "../banshare";
import { modmailHandler } from "../modmail";

export const dmButtons = async (interaction: ButtonInteraction<CacheType>): Promise<void> => {
    const customIdArgs = interaction.customId.split(' ');
    const command = customIdArgs.shift();

    switch (command) {
        case DmMessageButtonArg.NEW_BANSHARE: 
            await banshareManager.dmBanshareFunction(customIdArgs[0], undefined, interaction);
            break;

        case DmMessageButtonArg.OPEN_MODMAIL: {
            await modmailHandler.startModmail(interaction);
            const message = interaction.channel?.messages.cache.get(customIdArgs[1]);
            if(!message) {
                throw new Error(ErrorNames.MESSAGE_DOES_NOT_EXIST);
            }
            await modmailHandler.forwardModmailMessage(message);
            break;
        }

        case DmMessageButtonArg.CLOSE_MODMAIL: {
            const modmail = await databaseManager.getModmailByUserId(interaction.user.id);
            if(!modmail) throw new Error(ErrorNames.NO_MODMAIL_IN_DB);
            await modmailHandler.closeModmail(modmail.channelId);
            break;
        }
    }
}