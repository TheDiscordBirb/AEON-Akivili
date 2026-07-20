import { Command } from '../../structures/command';
import {
    ApplicationCommandOptionType,
    BaseGuildTextChannel,
    ChannelType,
    PermissionFlagsBits,
    TextChannel
} from 'discord.js'
import { joinHandler } from '../../functions/join-handler';
import { databaseManager } from '../../structures/database';
import { NetworkJoinOptions, RunOptions } from '../../types/command';
import { Logger } from '../../logger';
import { permissionHandler } from '../../functions/permission-handler';
import { errorHandler } from '../../structures/error-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { joinNetworkButtons } from '../../functions/buttons';

const logger = new Logger('JoinNetworkCmd');

// TEST: test
export const joinNetworkChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);

    const guildChannel = options.interaction.channel as BaseGuildTextChannel;
    if (guildChannel.type !== ChannelType.GuildText) throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);

    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: true},
        options.interaction.guild,
        [
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageWebhooks,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ModerateMembers
        ]);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral"});
        throw new Error(ErrorNames.NO_PERMISSIONS)
    }

    const argChannel = options.args.getChannel('channel');
    let channel = argChannel ? argChannel as TextChannel : options.interaction.channel as TextChannel;
    if (!channel) throw new Error(ErrorNames.NO_INTERACTION_CHANNEL);

    const channelType = options.args.getString('type');
    if (!channelType) throw new Error(ErrorNames.NO_REQUIRED_FIELD);

    if (!channel.guild) throw new Error(ErrorNames.NO_GUILD);

    const broadcastRecords = await databaseManager.getBroadcasts();
    const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
    if (channelWebhook) {
        const webhooks = await (options.interaction.channel as TextChannel).fetchWebhooks();
        if (webhooks.get(channelWebhook.webhookId)) {
            await options.interaction.reply({ content: `This channel is already connected to Aeon ${channelWebhook.channelType}, please select another channel!` });   
            return;
        }
    }

    await joinNetworkCommand(
        options,
        channel,
        channelType
    );
}

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
        try {
            await joinNetworkChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.JOIN_NETWORK
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const joinNetworkCommand = async (options: RunOptions, channel: TextChannel, channelType: string) => {
    const requestMessage = await joinHandler.requestNetworkAccess({
        guild: channel.guild, 
        channel: channel, type: channelType, user: options.interaction.user 
    });

    await options.interaction.reply({
        content: `Your application has been sent to join Aeon ${channelType}, you will be notified when your application has been reviewed.`,
        flags: 'Ephemeral' 
    });

    const collector = requestMessage.createMessageComponentCollector();
    collector.on('collect', async (interaction) => {
        if(interaction.isButton()) {
            await joinNetworkButtons(interaction);
        }
    });
}