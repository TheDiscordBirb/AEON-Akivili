import { 
    ApplicationCommandOptionType,
    BaseGuildTextChannel,
    ChannelType,
    GuildTextBasedChannel,
    WebhookClient
} from 'discord.js'
import { Command } from '../../structures/command';
import { clearanceLevel, rebuildNetworkInfoEmbeds } from '../../utils';
import { ClearanceLevel } from '../../types/client';
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
        if (!(clearanceLevel(options.interaction.user) >= ClearanceLevel.NAVIGATOR)) {
            await options.interaction.reply({ content: `You do not have permission to use this!`, ephemeral: true });
            return;
        }
        if (!options.args.get('name') && !options.args.get('link')) {
            await options.interaction.reply({ content: `You need to provide a name or a link.` });
            return;
        }

        const channel = options.interaction.channel as BaseGuildTextChannel;
        if (channel.type !== ChannelType.GuildText) return;

        const webhooks = config.activeWebhooks;
        const channelWebhook = webhooks.find((broadcast) => broadcast.channelId === channel.id);
        if (!channelWebhook) {
            await options.interaction.reply({ content: `No channel webhook.`, ephemeral: true });
            return;
        }
        if (channelWebhook.name.slice(5) !== NetworkJoinOptions.INFO) {
            await options.interaction.reply({ content: `No Aeon Info connection in this channel.`, ephemeral: true });
            return;
        }

        const embedMessage = options.interaction.channel?.messages.cache.find((message) => message.webhookId);
        if (!embedMessage) {
            // TODO: write log
            return;
        }

        const embeds = await rebuildNetworkInfoEmbeds(embedMessage, options.args.getString('name') ?? undefined, options.args.getString('link') ?? undefined, true);

        const relatedWebhooks = webhooks.filter((webhook) => webhook.name.slice(5) === NetworkJoinOptions.INFO);
        await Promise.allSettled(relatedWebhooks.map(async (relatedWebhook) => {

            const broadcastGuild = options.client.guilds.cache.get(relatedWebhook.guildId);
            if (!broadcastGuild) {
                // TODO: write log
                return undefined;
            }
            const guildChannel = broadcastGuild.channels.cache.get(relatedWebhook.channelId);
            if (!guildChannel) {
                // TODO: write log
                return undefined;
            }
            const guildMessage = (guildChannel as GuildTextBasedChannel).messages.cache.find((message) => message.webhookId);
            if (!guildMessage) {
                // TODO: write log
                return undefined;
            }

            await relatedWebhook.editMessage(guildMessage, { embeds: embeds });
        }));
        await options.interaction.reply({ content: `Network info embed has been successfully edited.`, ephemeral: true });
    }
});