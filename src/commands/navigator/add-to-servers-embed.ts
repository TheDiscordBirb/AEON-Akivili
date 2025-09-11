import { ApplicationCommandOptionType, BaseGuildTextChannel, ChannelType, GuildTextBasedChannel, WebhookClient } from 'discord.js'
import { Command } from '../../structures/command';
import { isNavigator, rebuildNetworkInfoEmbeds } from '../../utils';
import { databaseManager } from '../../structures/database';
import { NetworkJoinOptions } from '../../types/command';
import { Logger } from '../../logger';

const logger = new Logger('AddToServersEmbed');

export default new Command({
    name: 'add-to-servers-embed',
    description: 'Adds a server to the aeon info embed.',
    options:
    [{
        name: 'name',
        description: 'The name of the server.',
        type: ApplicationCommandOptionType.String,
        required: true
    },
    {
        name: 'link',
        description: 'The invite link to the server.',
        type: ApplicationCommandOptionType.String,
        required: true
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

        let webhook;
        try {
            webhook = await options.client.fetchWebhook(channelWebhook.webhookId);
        } catch (error) {
            logger.error(`Could not fetch webhook in guild: ${options.interaction.guild?.name ?? 'Unknown'} channel: ${channel.name ?? 'Unknown'}`, error as Error)
            return;
        };
        
        if (!webhook) {
            await options.interaction.reply({ content: `No webhook in this channel`, ephemeral: true });
            return;
        }
        if (!webhook.token) {
            await options.interaction.reply({ content: "Couldnt get Aeon webhook token, contact Birb to resolve this issue." });
            return;
        }

        const embedMessage = options.interaction.channel?.messages.cache.find((message) => message.webhookId);
        if (!embedMessage) {

            return;
        }

        const embeds = await rebuildNetworkInfoEmbeds(embedMessage, options.args.getString('name') ?? undefined, options.args.getString('link') ?? undefined);

        const matchingBroadcastRecords = broadcastRecords.filter((broadcastRecord) => broadcastRecord.channelType === webhookChannelType);
        await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
            const webhookClient = new WebhookClient({ id: broadcastRecord.webhookId, token: broadcastRecord.webhookToken });

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

            await webhookClient.editMessage(guildMessage, { embeds: embeds });
        }));
        await options.interaction.reply({ content: `Network info embed has been successfully edited.`, ephemeral: true });
    }
});