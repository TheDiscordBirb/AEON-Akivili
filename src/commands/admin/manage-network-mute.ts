import { Command } from '../../structures/command';
import { ApplicationCommandOptionType, PermissionFlagsBits, User } from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { Logger } from '../../logger';
import { config } from '../../const';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { clients } from '../../structures/client';
import { RunOptions } from '../../types/command';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { getInvite } from '../../utils/misc';
import { errorHandler } from '../../structures/error-handler';

const logger = new Logger('ManageMuteCmd');

export const manageMuteChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) {
        throw new Error(ErrorNames.NO_GUILD);
    }

    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: false},
        options.interaction.guild,
        [PermissionFlagsBits.MuteMembers],
        PermissionLevels.REPRESENTATIVE);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral"});
        throw new Error(ErrorNames.NO_PERMISSIONS);
    }

    if (!options.interaction.channel) {
        throw new Error(ErrorNames.NO_CHANNEL);
    }

    const messageId = options.args.getString('message-id');
    if (!messageId) {
        throw new Error(ErrorNames.NO_REQUIRED_FIELD);
    }
    
    const userId = await databaseManager.getUserId(options.interaction.channel.id, messageId);
    const userMessages = await databaseManager.getUniqueUserMessages(userId, 1);
    for(const client of clients) {
        if(client.guilds.cache.get(userMessages[0].guildId)) {
            await manageMuteCmd(client.users.cache.get(userId), options);
            return;
        }
    }
}

// TODO: test
export default new Command({
    name: 'manage-network-mute',
    description: "Mutes or unmutes a user on the aeon network channels",
    options:
    [{
        name: 'message-id',
        description: 'The id of the message you want to get the uid of.',
        type: ApplicationCommandOptionType.String,
        required: true
    },
    {
        name: 'anonymous-dm',
        description: 'Makes the mute notification anonymous.',
        type: ApplicationCommandOptionType.Boolean,
        required: false
    }],

    run: async (options) => {
        try {
            await manageMuteChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.MANAGE_NETWORK_MUTE
            })
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error);
        }
    }
});

export const manageMuteCmd = async (user: User | undefined, options: RunOptions) => {
    if(!user) {
        throw new Error(ErrorNames.NO_USER);
    }
    const userMutedState = await databaseManager.hasUserBeenMutedOnNetworkChat(user.id);
    if ((await databaseManager.whoMutedUser(user.id)) == config.birbId && options.interaction.user.id != config.birbId) {
        await options.interaction.reply({ content: `${user ? user : "User"} can not be unmuted as they were muted by Birb` });
        return;
    }
    
    await databaseManager.toggleNetworkChatMute(user.id, options.interaction.user.id);
    await options.interaction.reply({ content: `${user ? user : "User"} has been ${userMutedState ? "un" : ""}muted`, flags: 'Ephemeral' });
    if (user) {
        if (!user.dmChannel) {
            user.createDM();
        }
        const inviteInfo = await getInvite(config.mainServerId);
        let muteInfo = `\nTo dispute this join ${inviteInfo.invite} and open a modmail by sending ${inviteInfo.client.user} a message.`;
        if (!options.args.get('anonymous-dm')) {
            muteInfo = `by ${options.interaction.user.username}` + muteInfo;
        }
        await user.send(`You have been ${userMutedState ? "un" : ""}muted on the Aeon Network channels ${userMutedState ? "" : muteInfo}`);
    }
}