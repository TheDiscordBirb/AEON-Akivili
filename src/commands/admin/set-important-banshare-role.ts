import { ApplicationCommandOptionType, BaseGuildTextChannel, ChannelType, } from 'discord.js'
import { Command } from '../../structures/command';
import { databaseManager } from '../../structures/database'; 
import { hasModerationRights } from '../../utils';
import { Logger } from '../../logger';
import { NetworkJoinOptions } from '../../types/command';

const logger = new Logger('setBanshareRole');

export default new Command({
    name: 'set-important-banshare-role',
    description: "Set the role that gets pinged when a new important banshare is posted.",
    options:
    [{
        name: 'role',
        description: 'Leave this blank if you want to remove the current role',
        type: ApplicationCommandOptionType.Role,
        required: false
    }],

    run: async (options) => {
        if (!options.interaction.member) {
            await options.interaction.reply({ content: `You cant use this command outside a server.`, ephemeral: true });
            logger.warn(`Didnt get interaction member`);
            return;
        }
        if (!hasModerationRights(options.interaction.member)) {
            await options.interaction.reply({ content: `You do not have permission to use this!`, ephemeral: true });
            return;
        }

        let role = options.args.getRole('role');

        const channel = options.interaction.channel as BaseGuildTextChannel;
        if (channel.type !== ChannelType.GuildText) return;

        const broadcastRecords = await databaseManager.getBroadcasts();
        const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
        if (!channelWebhook) {
            await options.interaction.reply({ content: `No channel webhook.`, ephemeral: true });
            return;
        }
        if (channelWebhook.channelType !== NetworkJoinOptions.BANSHARE) {
            await options.interaction.reply({ content: `No Aeon Banshare connection in this channel.`, ephemeral: true });
            return;
        }

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

        const broadcastToEdit = broadcastRecords.find((broadcast) => broadcast.channelType === NetworkJoinOptions.BANSHARE && broadcast.guildId === options.interaction.guildId);
        if (!broadcastToEdit) {
            await options.interaction.reply({ content: `There is no banshare webhook in this server.`, ephemeral: true });
            return;
        }
        try {
            await databaseManager.saveBroadcast({ ...broadcastToEdit, importantBanshareRoleId: (role ? role.id : '') });
            await options.interaction.reply({ content: `Your important banshare ping role has been ${role ? `set to ${role}` : `removed`}`, allowedMentions: { parse: [] } });
        } catch (error) {
            logger.error(`Could not save broadcast. Error: `, error as Error);
            return;
        }
    }
})