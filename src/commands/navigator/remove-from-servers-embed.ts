import { 
    ApplicationCommandOptionType, 
    BaseGuildTextChannel, 
    ChannelType, 
    GuildTextBasedChannel, 
    MessageFlags 
} from 'discord.js'
import { Command } from '../../structures/command';
import { isNavigator, rebuildNetworkInfoEmbeds } from '../../utils';
import { databaseManager } from '../../structures/database';
import { NetworkJoinOptions } from '../../types/command';
import { Logger } from '../../logger';
import { config } from '../../const';

const logger = new Logger('RemoveFromServersEmbed');

export default new Command({
    name: 'remove-from-servers-embed',
    description: 'Removes a server from the aeon info embed.',
    options:
    [{
        name: 'name',
        description: 'The name of the server.',
        type: ApplicationCommandOptionType.String,
        required: false
    },
    {
        name: 'link',
        description: 'The invite link to the server.',
        type: ApplicationCommandOptionType.String,
        required: false
    }],

    run: async (options) => {
        if (!options.interaction.member) {
            await options.interaction.reply({ content: `You cant use this command outside a server.`, ephemeral: true });
            logger.warn(`Didnt get interaction member`);
            return;
        }
        if (!isNavigator(options.interaction.user)) {
            await options.interaction.reply({ content: `You do not have permission to use this!`, ephemeral: true });
            return;
        }
        if (!options.args.get('name') && !options.args.get('link')) {
            await options.interaction.reply({ content: `You need to provide a name or a link.` });
            return;
        }

        const channel = options.interaction.channel as BaseGuildTextChannel;
        if (channel.type !== ChannelType.GuildText) return;

        const broadcastRecords = await databaseManager.getBroadcasts();
        const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
        if (!channelWebhook) {
            await options.interaction.reply({ content: `No channel webhook.`, ephemeral: true });
            return;
        }
        if (channelWebhook.channelType !== NetworkJoinOptions.INFO) {
            await options.interaction.reply({ content: `No Aeon Info connection in this channel.`, ephemeral: true });
            return;
        }
        const webhookChannelType = channelWebhook.channelType;

        const webhooks = config.activeWebhooks.filter((webhook) => webhook.guildId === options.interaction.guildId);
        if(!webhooks) {
            await options.interaction.reply({content: 'This server is not connected to any Aeon channels.', flags: MessageFlags.Ephemeral});
            return;
        }
        const webhook = webhooks.find((channelWebhook) => channelWebhook.name.includes("Aeon"));
        if (!webhook) {
            await options.interaction.reply({ content: "Couldnt find Aeon webhook, contact Birb to resolve this issue." });
            return;
        }
        const webhookBroadcast = await databaseManager.getBroadcastBywebhookId(webhook.id);
        if (!webhookBroadcast) {
            await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, flags: MessageFlags.Ephemeral });
            logger.warn(`Could not get webhook broadcast`);
            return
        }

        const embedMessage = options.interaction.channel?.messages.cache.find((message) => message.webhookId);
        if (!embedMessage) {
            // TODO: write log
            return;
        }

        const embeds = await rebuildNetworkInfoEmbeds(embedMessage, options.args.getString('name') ?? undefined, options.args.getString('link') ?? undefined, true);

        const matchingBroadcastRecords = broadcastRecords.filter((broadcastRecord) => broadcastRecord.channelType === webhookChannelType);
        await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
            const webhook = webhooks.find((webhook) => webhook.id === broadcastRecord.webhookId);
            if(!webhook) {
                logger.warn(`Could not find webhook ${broadcastRecord.webhookId}`);
                return;
            }

            const broadcastGuild = options.client.guilds.cache.get(broadcastRecord.guildId);
            if (!broadcastGuild) {
                // TODO: write log
                return undefined;
            }
            const guildChannel = broadcastGuild.channels.cache.get(broadcastRecord.channelId);
            if (!guildChannel) {
                // TODO: write log
                return undefined;
            }
            const guildMessage = (guildChannel as GuildTextBasedChannel).messages.cache.find((message) => message.webhookId);
            if (!guildMessage) {
                // TODO: write log
                return undefined;
            }

            await webhook.editMessage(guildMessage, { embeds: embeds });
        }));
        await options.interaction.reply({ content: `Network info embed has been successfully edited.`, ephemeral: true });
    }
});