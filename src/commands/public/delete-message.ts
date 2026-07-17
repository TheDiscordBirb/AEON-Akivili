import {
    ApplicationCommandOptionType,
    BaseGuildTextChannel,
    ChannelType,
    Guild,
    GuildTextBasedChannel,
    Message,
    PermissionFlagsBits,
    User,
    Webhook,
    WebhookType,
} from "discord.js";
import { Command } from "../../structures/command"; 
import { Logger } from "../../logger";
import { databaseManager } from "../../structures/database";
import { config } from "../../const";
import { NotificationType } from "../../types/event";
import { notificationManager } from "../../functions/notification";
import { permissionHandler } from "../../functions/permission-handler";
import { PermissionLevels } from "../../types/permission-handler";
import { RunOptions } from "../../types/command";
import { errorHandler } from "../../structures/error-handler";
import { ErrorNames, InteractionTypes } from "../../types/error-handler";
import { whoIs } from "../../utils/client-checks";

const logger = new Logger('DeleteMessageCmd');

export const deleteMessageChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);
    const channel = options.interaction.channel as BaseGuildTextChannel;
    if (!channel) throw new Error(ErrorNames.NO_CHANNEL);
    if (channel.type !== ChannelType.GuildText) throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);
    const messageId = options.args.getString('message-id');
    if(!messageId) throw new Error(ErrorNames.NO_REQUIRED_FIELD);
    const message = await channel.messages.fetch(messageId);
    if(!message) throw new Error(ErrorNames.NO_MESSAGE);
    const broadcastRecords = await databaseManager.getBroadcasts();
    const channelBroadcast = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
    if (!channelBroadcast) throw new Error(ErrorNames.NO_BROADCAST_IN_DB)
    const webhooks = config.activeWebhooks;
    const guildWebhooks = webhooks.filter((webhook) => webhook.guildId === options.interaction.guildId);
    if(!guildWebhooks) throw new Error(ErrorNames.NO_WEBHOOKS_IN_GUILD);
    const webhook = guildWebhooks.find((channelWebhook) => channelWebhook.channelId === options.interaction.channelId);
    if (!webhook) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK);
    if(config.nonChatWebhooksTypes.includes(channelBroadcast.channelType)) return;
    
    await deleteMessageCmd(
        channelBroadcast.channelType,
        message,
        options,
        options.interaction.guild,
        webhooks
    );
}

// TODO: rework, test
export default new Command({
    name: 'delete-message',
    description: 'Used for deleting messages in a network channel.',
    options:
    [{
        name: 'message-id',
        description: 'The id of the message you want to delete.',
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
            try {
                await deleteMessageChecks(options);
            } catch(e) {
                await errorHandler.showError({
                    error: e as Error,
                    user: options.interaction.user,
                    interactionType: InteractionTypes.DELETE_MESSAGE
                })
                logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error);
            }
    }
})

export const deleteMessageCmd = async (
    channelType: string, 
    message: Message<boolean>, 
    options: RunOptions, 
    guild: Guild,
    webhooks: Webhook<WebhookType>[]
) => {
    const relatedMessageRecords = await databaseManager.getMessages(message.channelId, message.id, true);
    const matchingBroadcastRecords = (await databaseManager.getBroadcasts()).filter((broadcast) => broadcast.channelType === channelType);

    let deletedByMod = (relatedMessageRecords[0].userId === options.interaction.user.id) ? false : true;

    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: false},
        guild,
        [PermissionFlagsBits.ManageMessages],
        PermissionLevels.REPRESENTATIVE);

    if (!permissionCheck.status) {
        deletedByMod = false;
        if (relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === message.channelId)?.userId === options.interaction.user.id) {
            await options.interaction.reply({ content: "You do not have permission to delete this message.", flags: 'Ephemeral' });
            throw new Error(ErrorNames.NO_PERMISSIONS);
        }
        
    }

    await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
        const networkMessageRecord = relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === broadcastRecord.channelId);
        if (!networkMessageRecord) throw new Error(ErrorNames.NO_MESSAGE);
        const correctClient = await whoIs(networkMessageRecord.guildId);
        const networkChannel = correctClient.channels.cache.find((clientChannel) => clientChannel.id === broadcastRecord.channelId);
        if (!networkChannel) throw new Error(ErrorNames.NO_CHANNEL);
        const guildNetworkChannel = networkChannel as GuildTextBasedChannel;
        const networkMessage = guildNetworkChannel.messages.cache.find((guildMessage) => guildMessage.id === networkMessageRecord.channelMessageId);
        if (!networkMessage) throw new Error(ErrorNames.NO_MESSAGE);
        const webhook = webhooks.find((webhook) => webhook.id === broadcastRecord.webhookId);
        if(!webhook) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK_IN_CACHE);

        await webhook.deleteMessage(networkMessage);
    }))
    await options.interaction.reply({ content: `Successfully deleted message.`, flags: 'Ephemeral' });

    const targetUser = options.client.users.cache.find((clientUser) => clientUser.id === relatedMessageRecords[0].userId);
    await notificationManager.sendNotification({
        executingUser: targetUser as User,
        targetUser,
        message,
        notificationType: NotificationType.MESSAGE_DELETE,
        channelType: channelType,
        time: Date.now(),
        guild,
        deletedByMod
    });
}