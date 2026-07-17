import { Command } from '../../structures/command';
import { ApplicationCommandOptionType, Guild, GuildMember, Message, PermissionFlagsBits } from 'discord.js'
import { databaseManager } from '../../structures/database';
import { Logger } from '../../logger';
import { metrics } from '../../structures/metrics';
import { TimeSpanMetricLabel } from '../../types/metrics';
import { BanShareOption, RunOptions } from '../../types/command';
import { permissionHandler } from '../../functions/permission-handler';
import { notificationManager } from '../../functions/notification';
import { NotificationType } from '../../types/event';
import { banshareManager } from '../../functions/banshare';
import { errorHandler } from '../../structures/error-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';

const logger = new Logger('BanCmd');

// TODO: test
export const banChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) {
        throw new Error(ErrorNames.NO_GUILD)
    }

    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: true},
        options.interaction.guild,
        [PermissionFlagsBits.BanMembers]);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral"});
        throw new Error(ErrorNames.NO_PERMISSIONS);
    }

    const banshareResponse = options.args.getString('banshare');
    
    if (!options.interaction.channel) {
        logger.wtf(`${options.interaction.member.user.username} has used a command without a channel.`);
        throw new Error(ErrorNames.NO_INTERACTION_CHANNEL);
    }
        
    const messageId = options.args.getString('message-id');
    if (!messageId) {
        logger.warn(`${options.interaction.member.user.username} has used a command without the required field 'message-id'.`);
        throw new Error(ErrorNames.NO_MESSAGE_ID);
    }
    const message = await options.interaction.channel.messages.fetch(messageId);
    if (!message) {
        throw new Error(ErrorNames.MESSAGE_DOES_NOT_EXIST);
    }
    
    const userId = await databaseManager.getUserId(options.interaction.channel.id, messageId);

    const broadcasts = await databaseManager.getBroadcasts();

    const messageRecords = await databaseManager.getMessages(message.channel.id, message.id);

    const messageChannelType = broadcasts.find((broadcast) => broadcast.channelId === messageRecords[0].channelId)?.channelType;
    if(!messageChannelType) {
        throw new Error(ErrorNames.NO_CHANNEL_TYPE);
    }
    
    const userInfo = Object.values(broadcasts).reduce<{ guildMember?: GuildMember, userIsModerator: boolean }>((acc, broadcast) => {
        const guild = options.client.guilds.cache.get(broadcast.guildId);
        if (!guild) return acc;
        if (acc.userIsModerator) return acc;
        const guildMember = guild.members.cache.find((user) => user.id === userId);
        if (!guildMember) return acc;
        if (guildMember.permissions.has(PermissionFlagsBits.BanMembers)) {
            return {guildMember, userIsModerator: true};
        }
        return { guildMember, userIsModerator: false };
    }, {guildMember: undefined, userIsModerator: false});

    await banCommand(
        userInfo,
        messageChannelType,
        message,
        options.interaction.guild,
        banshareResponse,
        userId,
        options
    );
}


export default new Command({
    name: 'ban',
    description: 'Bans a person using a message id from Aeon Chat',
    options: [
        {
            name: 'message-id',
            description: 'The id of the message you want to ban the sender of.',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'banshare',
            description: 'Would you like to automatically submit a banshare request on this person?',
            type: ApplicationCommandOptionType.String,
            choices: [
                { name: 'Yes', value: BanShareOption.YES },
                { name: 'No', value: BanShareOption.NO },
            ],
            required: false
        }
    ],
    
    run: async (options) => {
        const metricId = metrics.start(TimeSpanMetricLabel.CMD_BAN);
        try {
            await banChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.BAN
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error);
        }
        metrics.stop(metricId);
    }
});

export const banCommand = async (
    userInfo: {guildMember?: GuildMember, userIsModerator: boolean},
    messageChannelType: string,
    message: Message<boolean>,
    guild: Guild,
    banshareResponse: string | null,
    userId: string,
    options: RunOptions
) => {
    if (userInfo.userIsModerator) {
        await options.interaction.reply({ content: 'This user is a moderator on a server in the network, as such AEON Navigators have been notified.', flags: 'Ephemeral' });
        await notificationManager.sendNotification({
            executingUser: options.interaction.user,
            targetUser: userInfo.guildMember?.user,
            channelType: messageChannelType,
            message: message,
            notificationType: NotificationType.MODERATOR_BAN,
            time: Date.now(),
            guild
        })
        return;
    }
    
    await guild.bans.create(userId);
    await options.interaction.reply({ content: `${userInfo.guildMember ? userInfo.guildMember : userId} has been banned.`, flags: 'Ephemeral' });

    if(banshareResponse == BanShareOption.YES) {
        await banshareManager.dmBanshareFunction(guild.id, options);
    }
}