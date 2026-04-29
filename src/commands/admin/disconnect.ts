import { Command } from '../../structures/command';
import { ApplicationCommandOptionType, Guild, MessageFlags, PermissionFlagsBits } from 'discord.js'
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { config } from '../../const';
import { permissionHandler } from '../../functions/permission-handler';
import { NetworkJoinOptions } from '../../types/command';
import { BroadcastRecord } from '../../types/database';
import { clients } from '../../structures/client';

const logger = new Logger('DisconnectCmd');

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
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', flags: 'Ephemeral' });
            return;
        }
        const permissionCheck = await permissionHandler.checkForPermission(
            options.interaction.user,
            {local: true, onlyLocal: true},
            options.interaction.guild,
            [PermissionFlagsBits.Administrator]);
            
        if(!permissionCheck.status) {
            await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral"});
            return;
        }

        const guildWebhooks = config.activeWebhooks;
        if(!guildWebhooks) {
            await options.interaction.reply({content: 'This server is not connected to any Aeon channels.', flags: 'Ephemeral'});
            return;
        }
        const guildBroadcasts = (await databaseManager.getBroadcasts()).filter((broadcast) => broadcast.guildId === options.interaction.guildId);
        const correctBroadcast = guildBroadcasts.find((broadcast) => broadcast.channelType === options.args.getString("type"));
        if(!correctBroadcast) {
            await options.interaction.reply({content: "Could not find that type of channel in this server.", flags: 'Ephemeral'});
            return;
        }
        const correctWebhook = guildWebhooks.find((gWebhook) => gWebhook.id === correctBroadcast.webhookId);
        if(!correctWebhook) {
            await options.interaction.reply({content: "Could not find webhook for that type of channel.", flags: 'Ephemeral'});
            return;
        }

        let leavingGuild: Guild | undefined;
        try {
            const client = clients.find((client) => client.user?.id === correctBroadcast.serviceClientId);
            if(!client) {
                logger.warn(`Could not get client for leaving guild.`);
                await options.interaction.reply({content: "Could not get correct bot client for this server.", flags: 'Ephemeral'});
                return;
            }
            leavingGuild = client.guilds.cache.get(correctBroadcast.guildId);
            if(!leavingGuild) {
                await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, flags: 'Ephemeral' });
                logger.warn(`Could not get webhook guild`);
                return;
            }   
        } catch (error) {
            await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, flags: 'Ephemeral' });
            logger.error(`Could not disconnect channel1. Error:`, (error as Error));
        }
        try {
            if (config.nonChatWebhooks.includes(correctWebhook.name)) return;
            const relatedBroadcastRecords = (await databaseManager.getBroadcasts()).filter((broadcast) => broadcast.channelType === correctBroadcast.channelType && broadcast.webhookId !== correctBroadcast.webhookId);
            if(!leavingGuild) return;
            await sendMessages(relatedBroadcastRecords, leavingGuild.name);
        } catch (error) {
            await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, flags: 'Ephemeral' });
            logger.error(`Could not disconnect channel2. Error:`, (error as Error));
        }
        try{
            await databaseManager.deleteBroadcastByWebhookId(correctWebhook.id);
            await correctWebhook.delete();
            await options.interaction.reply(`Successfully disconnected from Aeon ${correctBroadcast.channelType}`);
        } catch (error) {
            await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, flags: 'Ephemeral' });
            logger.error(`Could not disconnect channel3. Error:`, (error as Error));
        }
    }
});

const sendMessages = async (relatedBroadcastRecords: BroadcastRecord[], leavingGuildName: string) => {
    await Promise.allSettled(relatedBroadcastRecords.map(async (broadcastRecord) => {
        const client = clients.find((client) => client.user?.id === broadcastRecord.serviceClientId);
        if(!client) {
            logger.warn(`Could not get client for ${broadcastRecord.channelId}`);
            return;
        }
        const webhook = await client.fetchWebhook(broadcastRecord.webhookId);
        if(!webhook) {
            logger.warn(`Could not get webhook ${broadcastRecord.webhookId}`);
        }
        const webhookMessage = `${leavingGuildName ?? "A server"} has left Aeon ${broadcastRecord.channelType}`;
        await webhook.send({content: `\`${webhookMessage}\``, username: 'Akivili'});
    }));
}