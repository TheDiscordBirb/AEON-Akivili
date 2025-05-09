import { 
    ApplicationCommandOptionType,
    BaseGuildTextChannel,
    ChannelType,
    GuildTextBasedChannel
} from 'discord.js'
import { Command } from '../../structures/command';
import { clearanceLevel, rebuildNetworkInfoEmbeds } from '../../utils';
import { NetworkJoinOptions } from '../../types/command';
import { Logger } from '../../logger';
import { config } from '../../const';
import { ClearanceLevel } from '../../types/client';

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
        if (!(clearanceLevel(options.interaction.user) >= ClearanceLevel.NAVIGATOR)) {
            await options.interaction.reply({ content: `You do not have permission to use this!`, ephemeral: true });
            return;
        }

        const channel = options.interaction.channel as BaseGuildTextChannel;
        if (channel.type !== ChannelType.GuildText) return;

        const webhooks = config.activeWebhooks;
        const channelWebhook = webhooks.find((webhook) => webhook.channelId === channel.id);
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
            await options.interaction.reply({content: "Could not get the info embed, please open a ticket on the main server or message Birb or Blue."});
            return;
        }

        const embeds = await rebuildNetworkInfoEmbeds(embedMessage, options.args.getString('name') ?? undefined, options.args.getString('link') ?? undefined);

        const infoWebhooks = webhooks.filter((webhook) => webhook.name.slice(5) === NetworkJoinOptions.INFO);
        await Promise.allSettled(infoWebhooks.map(async (infoWebhook) => {
            const broadcastGuild = options.client.guilds.cache.get(infoWebhook.guildId);
            if (!broadcastGuild) {
                // TODO: write log
                return undefined;
            }
            const guildChannel = broadcastGuild.channels.cache.get(infoWebhook.channelId);
            if (!guildChannel) {
                // TODO: write log
                return undefined;
            }
            const guildMessage = (guildChannel as GuildTextBasedChannel).messages.cache.find((message) => message.webhookId);
            if (!guildMessage) {
                // TODO: write log
                return undefined;
            }

            await infoWebhook.editMessage(guildMessage, { embeds: embeds });
        }));
        await options.interaction.reply({ content: `Network info embed has been successfully edited.`, ephemeral: true });
    }
});