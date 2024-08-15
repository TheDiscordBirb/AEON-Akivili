import { Command } from '../../structures/command';
import { BaseGuildTextChannel, ChannelType } from 'discord.js'
import { Logger } from '../../logger';
import { NetworkJoinOptions } from '../../types/command';
import { databaseManager } from '../../structures/database';
import { hasModerationRights } from '../../utils';

const logger = new Logger('RecoverWebhookCmd');

export default new Command({
    name: 'recover-connection',
    description: "Recovers a webhook from a channel and saves it back into the database",
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
            await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
            return;
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
        const webhook = webhooks.find((channelWebhook) => channelWebhook.name.includes(NetworkJoinOptions.GENERAL) || channelWebhook.name.includes(NetworkJoinOptions.STAFF));
        if (!webhook) {
            await options.interaction.reply({ content: "Couldnt find Aeon webhook, contact Birb to resolve this issue." });
            return;
        }
        if (!webhook.token) {
            await options.interaction.reply({ content: "Couldnt get Aeon webhook token, contact Birb to resolve this issue." });
            return;
        }

        const broadcasts = await databaseManager.getBroadcasts();
        const webhookExistsInDb = !!broadcasts.find((broadcast) => broadcast.webhookId === webhook.id) ? true : false;

        if (webhookExistsInDb) {
            await options.interaction.reply({ content: `This connection is already saved in the database.`, ephemeral: true });
            return;
        }

        const webhookNameParts = webhook.name.split(' ');
        const webhookChannelType = webhookNameParts[webhookNameParts.length - 1];

        try {
            await databaseManager.saveBroadcast({ guildId: webhook.guildId, channelId: channel.id, channelType: webhookChannelType, webhookId: webhook.id, webhookToken: webhook.token, importantBanshareRoleId: '', autoBanLevel: 0 });
            await options.interaction.reply({ content: `This channel has been reconnected to ${webhook.name}.`, ephemeral: true });
        } catch (error) {
            logger.error(`Could not save broadcast. Error: `, error as Error);
            return;
        }
    }
});