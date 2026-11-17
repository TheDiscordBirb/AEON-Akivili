import { 
    ButtonInteraction, 
    CacheType, 
    PermissionFlagsBits, 
} from "discord.js";
import { databaseManager } from "../../structures/database";
import { ErrorNames } from "../../types/error-handler";
import { modmailHandler } from "../modmail";
import { permissionHandler } from "../permission-handler";

export const modmailCloseButton = async (interaction: ButtonInteraction<CacheType>): Promise<void> => {
    const user = interaction.user;
    if(!interaction.guild) throw new Error(ErrorNames.NO_GUILD);

    const guildMember = interaction.guild.members.cache.get(user.id);
    if(!guildMember) throw new Error(ErrorNames.NO_GUILD_MEMBER);

    const permissionCheck = await permissionHandler.checkForPermission(
        guildMember.user,
        { local: true, onlyLocal: true },
        guildMember.guild,
        [PermissionFlagsBits.BanMembers]);
        
    if(!permissionCheck.status) throw new Error(ErrorNames.NO_PERMISSIONS);
    
    const modmail = databaseManager.getModmail(interaction.channelId);
    await modmailHandler.closeModmail(modmail.channelId);
}