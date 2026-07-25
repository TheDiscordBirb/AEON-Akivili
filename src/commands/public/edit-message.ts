import {
    ApplicationCommandOptionType,
    BaseGuildTextChannel,
    ChannelType,
    Guild,
    GuildTextBasedChannel,
    User,
    Webhook,
    WebhookType,
} from "discord.js";
import { Command } from "../../structures/command"; 
import { Logger } from "../../logger";
import { databaseManager } from "../../structures/database";
import { config } from "../../const";
import { notificationManager } from "../../functions/notification";
import { NotificationType } from "../../types/event";
import { RunOptions } from "../../types/command";
import { ErrorNames, InteractionTypes } from "../../types/error-handler";
import { BroadcastRecord, MessagesRecord } from "../../types/database";
import { clients } from "../../structures/client";
import { errorHandler } from "../../structures/error-handler";

const logger = new Logger('EditMessageCmd');

export const editMessageChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);
    
    const channel = options.interaction.channel as BaseGuildTextChannel;
    if (!channel) throw new Error(ErrorNames.NO_CHANNEL);
    if (channel.type !== ChannelType.GuildText) throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);

    const message = channel.messages.cache.find((channelMessage) => channelMessage.id === options.args.getString('message-id'));
    if (!message) throw new Error(ErrorNames.NO_MESSAGE);

    const webhooks = config.activeWebhooks;
    const guildWebhooks = webhooks.filter((webhook) => webhook.guildId === options.interaction.guildId);
    if(!guildWebhooks) throw new Error(ErrorNames.NO_WEBHOOKS_IN_GUILD);

    const webhook = guildWebhooks.find((channelWebhook) => channelWebhook.channelId === options.interaction.channelId);
    if (!webhook) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK);
    
    const webhookBroadcast = await databaseManager.getBroadcastByWebhookId(webhook.id);
    if (!webhookBroadcast) throw new Error(ErrorNames.NO_BROADCAST_IN_DB);
    if(config.nonChatWebhooksTypes.includes(webhookBroadcast.channelType)) throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);
    
    const webhookChannelType = webhookBroadcast.channelType;

    const relatedMessageRecords = await databaseManager.getMessages(message.channelId, message.id);
    const matchingBroadcastRecords = (await databaseManager.getBroadcasts())
        .filter((broadcast) => broadcast.channelType === webhookChannelType);

    if (relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === message.channelId)?.userId === options.interaction.user.id) {
        throw new Error(ErrorNames.NO_PERMISSIONS);
    }

    await EditMessageCommand(
        matchingBroadcastRecords,
        relatedMessageRecords,
        options,
        webhooks,
        webhookChannelType,
        message.content,
        options.interaction.guild
    );
}

// TODO: test
export default new Command({
    name: 'edit-message',
    description: 'Used for editing messages in a network channel.',
    options:
    [{
        name: 'message-id',
        description: 'The id of the message you want to edit.',
        type: ApplicationCommandOptionType.String,
        required: true
    },
    {
        name: 'content',
        description: 'The new content of the edited message',
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
        try {
            await editMessageChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.EDIT_MESSAGE
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
})

export const EditMessageCommand = async (
    matchingBroadcastRecords: BroadcastRecord[],
    relatedMessageRecords: MessagesRecord[],
    options: RunOptions,
    webhooks: Webhook<WebhookType>[],
    webhookChannelType: string,
    oldMessageContent: string,
    guild: Guild
) => {
    await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
        const networkMessageRecord = relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === broadcastRecord.channelId);
        if (!networkMessageRecord) throw new Error(ErrorNames.NO_BROADCAST_IN_DB);

        const client = clients.find((client) => client.guilds.cache.has(broadcastRecord.guildId));
        if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_SERVER);

        const networkChannel = client.channels.cache.find((clientChannel) => clientChannel.id === broadcastRecord.channelId);
        if (!networkChannel) throw new Error(ErrorNames.NO_CHANNEL);

        const guildNetworkChannel = networkChannel as GuildTextBasedChannel;
        const networkMessage = guildNetworkChannel.messages.cache.find((guildMessage) => guildMessage.id === networkMessageRecord.channelMessageId);
        
        if (!networkMessage) throw new Error(ErrorNames.NO_MESSAGE);
        const webhook = webhooks.find((webhook) => webhook.id === broadcastRecord.webhookId);
        if(!webhook) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK_IN_CACHE);

        await webhook.editMessage(networkMessage, { content: options.args.getString('content') });
        await options.interaction.reply({ content: `Successfully edited message.`, flags: 'Ephemeral' });
    }));
    
    const targetUser = options.client.users.cache.find((clientUser) => clientUser.id === relatedMessageRecords[0].userId);
    await notificationManager.sendNotification({
        executingUser: targetUser as User,
        targetUser: targetUser,
        channelType: webhookChannelType,
        oldContent: oldMessageContent,
        newContent: options.args.getString('content') ?? undefined,
        notificationType: NotificationType.MESSAGE_EDIT,
        time: Date.now(),
        guild
    });
}