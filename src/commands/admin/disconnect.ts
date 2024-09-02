import { Command } from '../../structures/command';
import { BaseGuildTextChannel, ChannelType, Guild, WebhookClient } from 'discord.js'
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { hasModerationRights, isNavigator } from '../../utils';
import { config } from '../../const';
import { client } from '../../structures/client';

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

        const user = options.interaction.guild.members.cache.get(options.interaction.member.user.id);
        if (!user) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }
        if (!hasModerationRights(user)) {
            const navUser = client.users.cache.get(user.id);
            if (!navUser || !isNavigator(navUser)) { 
                await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
                return;
            }
        }

        let webhooks;
        try {
            webhooks = await channel.fetchWebhooks();
        } catch (error) {
            await options.interaction.reply({ content: "Couldnt fetch webhooks, contact Birb to resolve this issue.", ephemeral: true });
            logger.warn(`Could not fetch webhooks.`, (error as Error));
            return;
        }
        if (!webhooks) {
            await options.interaction.reply({ content: "Couldnt find Aeon webhook, contact Birb to resolve this issue." });
            return;
        }
        const webhook = webhooks.find((channelWebhook) => channelWebhook.name.includes("Aeon"));
        if (!webhook) {
            await options.interaction.reply({ content: "Couldnt find Aeon webhook, contact Birb to resolve this issue." });
            return;
        }
        if (!webhook.token) {
            await options.interaction.reply({ content: "Couldnt get Aeon webhook token, contact Birb to resolve this issue." });
            return;
        }
        
        const webhookNameParts = webhook.name.split(' ');
        const webhookChannelType = webhookNameParts[webhookNameParts.length - 1];

        let leavingGuild: Guild | undefined;
        try {
            const webhookName = webhook.name;
            const webhookBroadcast = (await databaseManager.getBroadcasts()).find((broadcast) => broadcast.webhookId === webhook.id);
            if (!webhookBroadcast) {
                await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, ephemeral: true });
                logger.warn(`Could not get webhook broadcast`);
                return
            }
            leavingGuild = client.guilds.cache.get(webhookBroadcast.guildId);
            if (!leavingGuild) {
                await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, ephemeral: true });
                logger.warn(`Could not get webhook guild`);
                return
            }
            await databaseManager.deleteBroadcastByWebhookId(webhook.id);
            await webhook.delete();
            await options.interaction.reply(`Successfully disconnected from ${webhookName}`);
        } catch (error) {
            await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, ephemeral: true });
            logger.error(`Could not disconnect channel. Error:`, (error as Error));
        }

        if (config.nonChatWebhooks.includes(webhook.name)) return;
        const relatedBroadcastRecords = (await databaseManager.getBroadcasts()).filter((broadcast) => broadcast.channelType === webhookChannelType);

        await Promise.allSettled(relatedBroadcastRecords.map(async (broadcastRecord) => {
            const webhook = new WebhookClient({ id: broadcastRecord.webhookId, token: broadcastRecord.webhookToken });
            const guild = client.guilds.cache.get(broadcastRecord.guildId);
            if (!guild) {
                logger.warn(`Could not find guild with id ${broadcastRecord.guildId}`);
                return;
            }

            const webhookMessage = `${leavingGuild ? leavingGuild.name : "A server"} has left Aeon ${webhookChannelType}`;
            const formating = '`';
            await webhook.send({content: `${formating}${webhookMessage}${formating}`, username: 'Akivili'});
        }))
    }
});