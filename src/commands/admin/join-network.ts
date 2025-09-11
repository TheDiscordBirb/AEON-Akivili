import { Command } from '../../structures/command';
import {
    ApplicationCommandOptionType,
    BaseGuildTextChannel,
    ChannelType,
    TextChannel
} from 'discord.js'
import { hasModerationRights } from '../../utils';
import { joinHandler } from '../../functions/join-handler';
import { databaseManager } from '../../structures/database';
import { NetworkJoinOptions } from '../../types/command';
import { Logger } from '../../logger';

const logger = new Logger('JoinNetworkCmd');

export default new Command({
    name: 'join-network',
    description: 'Joins the specified channel to the Aeon Network.',
    options:
    [{
        name: 'type',
        description: 'The type of network you want to join (Staff/General).',
        type: ApplicationCommandOptionType.String,
        choices: [
            { name: "General", value: NetworkJoinOptions.GENERAL },
            { name: "Staff", value: NetworkJoinOptions.STAFF },
            { name: "Banshare", value: NetworkJoinOptions.BANSHARE },
            { name: "Network Info", value: NetworkJoinOptions.INFO }
        ],
        required: true
    }, {
        name: 'channel',
        description: 'The channel you want to connect with (this defaults to the current channel).',
        type: ApplicationCommandOptionType.Channel,
        required: false
    }],

    run: async (options) => {
        const guildMember = options.interaction.guild?.members.cache.find((member) => member.id === options.interaction.member.user.id);
        if (!guildMember) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }

        const guildChannel = options.interaction.channel as BaseGuildTextChannel;
        if (guildChannel.type !== ChannelType.GuildText) {
            await options.interaction.reply({ content: `You cant use this here.`, ephemeral: true });
            return;
        }

        if (!hasModerationRights(guildMember)) {
            await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
            return;
        }

        const argChannel = options.args.getChannel('channel');
        let channel = argChannel ? argChannel as TextChannel : options.interaction.channel as TextChannel;
        if (!channel) {
            logger.wtf(`${options.interaction.member.user.username} has used a command without a channel.`)
            return;
        }

        if (!channel.guild) {
            await options.interaction.reply('You cant use this here');
            return;
        }

        const broadcastRecords = await databaseManager.getBroadcasts();
        const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
        if (channelWebhook) {
            try {
                const webhooks = await (options.interaction.channel as TextChannel).fetchWebhooks();
                if (webhooks.get(channelWebhook.webhookId)) {
                    await options.interaction.reply({ content: `This channel is already connected to Aeon ${channelWebhook.channelType}, please select another channel!` });   
                    return;
                }
            } catch (error) {
                logger.warn(`Couldnt get webhook`, (error as Error));
            }
        }

        const channelType = options.args.getString('type');
        if (!channelType) {
            logger.wtf(`${options.interaction.member.user.username} has used a command without the required field 'type'.`);
            await options.interaction.reply({ content: `Network type not selected.`, ephemeral: true });
            return;
        }

        try {
            await joinHandler.requestNetworkAccess({ guild: channel.guild, channel: channel, type: channelType, user: options.interaction.user });
            await options.interaction.reply({ content: `Your application has been sent to join Aeon ${channelType}, you will be notified when your application has been reviewed.`, ephemeral: true });
        } catch (error) {
            logger.error('Could not send application', error as Error);
        }
    }
});