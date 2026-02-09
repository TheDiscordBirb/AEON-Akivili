import { Command } from '../../structures/command';
import { BaseGuildTextChannel, ChannelType, Guild, MessageFlags, PermissionFlagsBits } from 'discord.js'
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { config } from '../../const';
import { client } from '../../structures/client';
import { permissionHandler } from '../../functions/permission-handler';

const logger = new Logger('DisconnectCmd');

export default new Command({
    name: 'disconnect',
    description: "Disconnects a channel from the network connection.",
    options:[],

    run: async (options) => {
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }

        const channel = options.interaction.channel as BaseGuildTextChannel;
        if (channel.type !== ChannelType.GuildText) return;

        const permissionCheck = await permissionHandler.checkForPermission(
            options.interaction.user,
            {local: true, onlyLocal: true},
            options.interaction.guild,
            [PermissionFlagsBits.Administrator]);
            
        if(!permissionCheck.status) {
            await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral"});
            return;
        }

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
        const webhookBroadcast = await databaseManager.getBroadcastByWebhookId(webhook.id);
        if (!webhookBroadcast) {
            await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, flags: MessageFlags.Ephemeral });
            logger.warn(`Could not get webhook broadcast`);
            return
        }

        let leavingGuild: Guild | undefined;
        try {
            leavingGuild = client.guilds.cache.get(webhookBroadcast.guildId);
            if (!leavingGuild) {
                await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, flags: MessageFlags.Ephemeral });
                logger.warn(`Could not get webhook guild`);
                return
            }
            await databaseManager.deleteBroadcastByWebhookId(webhook.id);
            await webhook.delete();
            await options.interaction.reply(`Successfully disconnected from Aeon ${webhookBroadcast.channelType}`);
        } catch (error) {
            await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, flags: MessageFlags.Ephemeral });
            logger.error(`Could not disconnect channel. Error:`, (error as Error));
        }

        if (config.nonChatWebhooks.includes(webhook.name)) return;
        const relatedBroadcastRecords = (await databaseManager.getBroadcasts()).filter((broadcast) => broadcast.channelType === webhookBroadcast.channelType);

        await Promise.allSettled(relatedBroadcastRecords.map(async (broadcastRecord) => {
            const webhook = webhooks.find((webhook) => webhook.id === broadcastRecord.webhookId);
            if(!webhook) {
                logger.warn(`Could not find webhook ${broadcastRecord.webhookId}`);
                return;
            }
            const guild = client.guilds.cache.get(broadcastRecord.guildId);
            if (!guild) {
                logger.warn(`Could not find guild with id ${broadcastRecord.guildId}`);
                return;
            }

            const webhookMessage = `${leavingGuild ? leavingGuild.name : "A server"} has left Aeon ${broadcastRecord.channelType}`;
            const formating = '`';
            await webhook.send({content: `${formating}${webhookMessage}${formating}`, username: 'Akivili'});
        }))
    }
});