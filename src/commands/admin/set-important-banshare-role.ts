import { APIRole, ApplicationCommandOptionType, BaseGuildTextChannel, ChannelType, PermissionFlagsBits, Role, } from 'discord.js'
import { Command } from '../../structures/command';
import { databaseManager } from '../../structures/database'; 
import { Logger } from '../../logger';
import { NetworkJoinOptions, RunOptions } from '../../types/command';
import { permissionHandler } from '../../functions/permission-handler';
import { errorHandler } from '../../structures/error-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { BroadcastRecord } from '../../types/database';

const logger = new Logger('SetBanshareRole');

export const setImportantBanshareRoleChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);

    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: true},
        options.interaction.guild,
        [PermissionFlagsBits.Administrator]);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral" });
        throw new Error(ErrorNames.NO_PERMISSIONS);
    }

    const channel = options.interaction.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);

    const broadcastRecords = await databaseManager.getBroadcasts();
    const channelBroadcast = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
    if (!channelBroadcast) throw new Error(ErrorNames.NO_BROADCAST_IN_DB)
    if (channelBroadcast.channelType !== NetworkJoinOptions.BANSHARE) throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);

    const webhook = await options.client.fetchWebhook(channelBroadcast.webhookId);
    if(!webhook) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK);

    const broadcastToEdit = broadcastRecords.find(
        (broadcast) => broadcast.channelType === NetworkJoinOptions.BANSHARE && broadcast.guildId === options.interaction.guildId
    );
    if (!broadcastToEdit) throw new Error(ErrorNames.NO_BROADCAST_IN_DB);

    await setImportantBanshareRoleCommand(
        options,
        options.args.getRole('role'),
        broadcastToEdit
    )
}

// TODO: test
export default new Command({
    name: 'set-important-banshare-role',
    description: "Set the role that gets pinged when a new important banshare is posted.",
    options:
    [{
        name: 'role',
        description: 'Leave this blank if you want to remove the current role',
        type: ApplicationCommandOptionType.Role,
        required: false
    }],

    run: async (options) => {
        try {
            await setImportantBanshareRoleChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.SET_IMPORTANT_BANSHARE_ROLE
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const setImportantBanshareRoleCommand = async (
    options: RunOptions,
    role: Role | APIRole | null,
    broadcastToEdit: BroadcastRecord
) => {
    await databaseManager.saveBroadcast({ ...broadcastToEdit, importantBanshareRoleId: (role ? role.id : '') });
    await options.interaction.reply({
        content: `Your important banshare ping role has been ${role ? `set to ${role}` : `removed`}`,
        allowedMentions: { parse: [] } 
    });
}