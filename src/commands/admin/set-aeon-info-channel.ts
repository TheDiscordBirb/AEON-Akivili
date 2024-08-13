import { BaseGuildTextChannel, ChannelType, } from 'discord.js'
import { Command } from '../../structures/command';
import { databaseManager } from '../../structures/database'; 
import { hasModerationRights } from '../../utils';
import { Logger } from '../../logger';

const logger = new Logger('SetAeonInfoChannel');

export default new Command({
    name: 'set-aeon-info-channel',
    description: "Sets the channel where the aeon network embed gets posted.",
    options:
    [],

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

        const channel = options.interaction.channel as BaseGuildTextChannel;
        if (channel.type !== ChannelType.GuildText) return;

        const broadcastRecords = await databaseManager.getBroadcasts();
        const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
        if (channelWebhook) {
            await options.interaction.reply({ content: `No channel webhook.`, ephemeral: true });
            return;
        }
    }
})