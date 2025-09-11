import { Command } from '../../structures/command';
import { ApplicationCommandOptionType, GuildMember } from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { hasModerationRights } from '../../utils';
import { banshareManager } from '../../functions/banshare';
import { MessagesRecord } from '../../types/database';
import { BanShareOption } from '../../types/command';
import { Logger } from '../../logger';
import { notificationManager } from '../../functions/notification';
import { NotificationType } from '../../types/event';
import { metrics } from '../../structures/metrics';
import { TimeSpanMetricLabel } from '../../types/metrics';
import { RunOptions } from '../../types/command';

const logger = new Logger('BanCmd');

const banCommand = async (options: RunOptions): Promise<void> => {
    if (!options.interaction.guild) {
        await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
        return;
    }
    
    const guildMember = options.interaction.guild.members.cache.find((member) => member.id === options.interaction.member.user.id);
    if (!guildMember) {
        logger.wtf("Interaction's creator does not exist.");
        return;
    }
    
    if (!hasModerationRights(guildMember)) {
        await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
        return;
    }

    const banshareResponse = options.args.getString('banshare');
    
    if (!options.interaction.channel) {
        logger.wtf(`${options.interaction.member.user.username} has used a command without a channel.`);
        return;
    }
        
    const messageId = options.args.getString('message-id');
    if (!messageId) {
        logger.warn(`${options.interaction.member.user.username} has used a command without the required field 'message-id'.`);
        await options.interaction.reply({ content: 'No message id provided.', ephemeral: true });
        return;
    }
    const message = await options.interaction.channel.messages.fetch(messageId);
    if (!message) {
        await options.interaction.reply({ content: 'This message does not exist.', ephemeral: true });
        return;
    }
    
    let userId: string;
    try {
        userId = await databaseManager.getUserId(options.interaction.channel.id, messageId);
    } catch (error) {
        logger.error(`There was an error fetching this user: ${messageId}`, error as Error);
        return;
    }
    const broadcasts = await databaseManager.getBroadcasts();

    let messageRecords: MessagesRecord[];
    try {
        messageRecords = await databaseManager.getMessages(message.channel.id, message.id);
    } catch (error) {
        logger.error(`There was an error getting the message record. Error: `, error as Error);
        return;
    }

    let messageChannelType = '';
    broadcasts.forEach((broadcast) => {
        if (broadcast.channelId === messageRecords[0].channelId) {
            messageChannelType = broadcast.channelType;
            return;
        }
    })
    
    const userInfo = Object.values(broadcasts).reduce<{ guildMember?: GuildMember, userIsModerator: boolean }>((acc, broadcast) => {
        const guild = options.client.guilds.cache.get(broadcast.guildId);
        if (!guild) return acc;
        if (acc.userIsModerator) return acc;
        const guildMember = guild.members.cache.find((user) => user.id === userId);
        if (!guildMember) return acc;
        if (hasModerationRights(guildMember)) {
            return {guildMember, userIsModerator: true};
        }
        return { guildMember, userIsModerator: false };
    }, {guildMember: undefined, userIsModerator: false});
    
    
    if (userInfo.userIsModerator) {
        await options.interaction.reply({ content: 'This user is a moderator on a server in the network, as such AEON Navigators have been notified.', ephemeral: true });
        notificationManager.sendNotification({
            executingUser: options.interaction.user,
            targetUser: userInfo.guildMember?.user,
            channelType: messageChannelType,
            message,
            notificationType: NotificationType.MODERATOR_BAN,
            time: Date.now(),
            guild: options.interaction.guild
        })
    }
    
    try {
        await options.interaction.guild.bans.create(userId);
        await options.interaction.reply({ content: `${userInfo.guildMember ? userInfo.guildMember : userId} has been banned.`, ephemeral: true });
    } catch (error) {
        logger.error(`Couldnt ban user.`, (error as Error));
        return;
    }
    
    if (userInfo.userIsModerator) {
        await options.interaction.reply({ content: 'This user is a moderator on a server in the network, as such AEON Navigators have been notified.', ephemeral: true });
    }
    notificationManager.sendNotification({
        executingUser: options.interaction.user,
        targetUser: userInfo.guildMember?.user,
        channelType: messageChannelType,
        message,
        notificationType: userInfo.userIsModerator ? NotificationType.MODERATOR_BAN : NotificationType.MODERATOR_BAN,
        time: Date.now(),
        guild: options.interaction.guild
    })

    if(banshareResponse) {
        await banshareManager.dmBanshareFunction(options.interaction.guild.id, options);
    }
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
            await banCommand(options);
        } catch (error) {
            logger.warn('Could not execute ban command', error as Error);
        }
        metrics.stop(metricId);
    }
});