import { Command } from '../../structures/command';
import { ApplicationCommandOptionType, PermissionFlagsBits, Webhook, WebhookType } from 'discord.js'
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { config } from '../../const';
import { permissionHandler } from '../../functions/permission-handler';
import { NetworkJoinOptions, RunOptions } from '../../types/command';
import { BroadcastRecord } from '../../types/database';
import { clients } from '../../structures/client';
import { errorHandler } from '../../structures/error-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';

const logger = new Logger('DisconnectCmd');

// TODO: test
export const disconnectChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);

    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: true},
        options.interaction.guild,
        [PermissionFlagsBits.Administrator]);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({ content: permissionCheck.message, flags: "Ephemeral" });
        throw new Error(ErrorNames.NO_PERMISSIONS)
    }

    const guildWebhooks = config.activeWebhooks;
    if(!guildWebhooks) throw new Error(ErrorNames.NO_WEBHOOKS_IN_GUILD);

    const guildBroadcasts = (await databaseManager.getBroadcasts()).filter((broadcast) => broadcast.guildId === options.interaction.guildId);
    const correctBroadcast = guildBroadcasts.find((broadcast) => broadcast.channelType === options.args.getString("type"));
    if(!correctBroadcast) throw new Error(ErrorNames.NO_BROADCAST_IN_DB);

    const correctWebhook = guildWebhooks.find((gWebhook) => gWebhook.id === correctBroadcast.webhookId);
    if(!correctWebhook) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK);


    const client = clients.find((client) => client.user?.id === correctBroadcast.serviceClientId);
    if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_SERVER);

    const leavingGuild = client.guilds.cache.get(correctBroadcast.guildId);
    if(!leavingGuild) throw new Error(ErrorNames.NO_LEAVING_GUILD);

    if (config.nonChatWebhooks.includes(correctWebhook.name)) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK_IN_CACHE);

    const relatedBroadcastRecords = (await databaseManager.getBroadcasts()).filter((broadcast) => broadcast.channelType === correctBroadcast.channelType && broadcast.webhookId !== correctBroadcast.webhookId);

    await disconnectCommand(
        correctWebhook,
        correctBroadcast,
        options,
        relatedBroadcastRecords, 
        leavingGuild.name
    );
}

export default new Command({
    name: 'disconnect',
    description: "Disconnects a channel from the network connection.",
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
    }],

    run: async (options) => {
        try {
            await disconnectChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.DISCONNECT
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);
        }
    }
});

export const disconnectCommand = async (
    correctWebhook: Webhook<WebhookType>,
    correctBroadcast: BroadcastRecord, 
    options: RunOptions,
    relatedBroadcastRecords: BroadcastRecord[],
    leavingGuildName: string
) => {
    await disconnectServer(correctWebhook, correctBroadcast, options);
    await sendMessages(relatedBroadcastRecords, leavingGuildName);
}

const disconnectServer = async (correctWebhook: Webhook<WebhookType>, correctBroadcast: BroadcastRecord, options: RunOptions) => {
    await databaseManager.deleteBroadcastByWebhookId(correctWebhook.id);
    await correctWebhook.delete();
    await options.interaction.reply(`Successfully disconnected from Aeon ${correctBroadcast.channelType}`);
}

const sendMessages = async (relatedBroadcastRecords: BroadcastRecord[], leavingGuildName: string) => {
    await Promise.allSettled(relatedBroadcastRecords.map(async (broadcastRecord) => {
        const client = clients.find((client) => client.user?.id === broadcastRecord.serviceClientId);
        if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_SERVER);
        const webhook = await client.fetchWebhook(broadcastRecord.webhookId);
        if(!webhook) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK);
        const webhookMessage = `${leavingGuildName ?? "A server"} has left Aeon ${broadcastRecord.channelType}`;
        await webhook.send({ content: `\`${webhookMessage}\``, username: 'Akivili' });
    }));
}