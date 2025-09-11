import { Command } from '../../structures/command';
import { ApplicationCommandOptionType, BaseGuildTextChannel, ChannelType } from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { hasModerationRights } from '../../utils';
import { Logger } from '../../logger';
import { metrics } from '../../structures/metrics';
import { TimeSpanMetricLabel } from '../../types/metrics';
import { RunOptions } from '../../types/command';

const logger = new Logger('RemoveReactionCmd');

const banCommand = async (options: RunOptions): Promise<void> => {
    if (!options.interaction.guild) {
        await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
        return;
    }
    
    const user = options.interaction.guild.members.cache.find((member) => member.id === options.interaction.member.user.id);
    if (!user) {
        logger.wtf("Interaction's creator does not exist.");
        return;
    }

    if (!options.interaction.channel) {
        await options.interaction.reply({ content: `Could not get interaction channel.`, ephemeral: true });
        return;
    }
    const channel = options.interaction.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) return;
    
    if (!hasModerationRights(user)) {
        await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
        return;
    }

    const messageId = options.args.getString('message-id');
    if (!messageId) {
        // TODO: write log
        return;
    }

    const message = channel.messages.cache.get(messageId);
    if (!message) {
        await options.interaction.reply({ content: `Couldnt find that message.`, ephemeral: true });
        // TODO: write log
        return;
    }

    const messageRecord = (await databaseManager.getMessages(message.channel.id, message.id)).find((record) => record.channelMessageId === message.id);
    if (!messageRecord) {
        await options.interaction.reply({ content: `Could not find message in database.`, ephemeral: true });
        // TODO: write log
        return;
    }

    const interactionReply = await options.interaction.reply({ content: message.content, components: message.components, ephemeral: true, fetchReply: true })
            
    await databaseManager.logMessage({ ...messageRecord, channelMessageId: interactionReply.id });
}


export default new Command({
    name: 'remove-reaction',
    description: 'Removes reactions from a network message.',
    options: [
        {
            name: 'message-id',
            description: 'The id of the message you want to remove a reacion from.',
            type: ApplicationCommandOptionType.String,
            required: true
        },
    ],
    
    run: async (options) => {
        const metricId = metrics.start(TimeSpanMetricLabel.CMD_REMOVE_REACTION);
        try {
            await banCommand(options);
        } catch (error) {
            logger.warn('Could not execute remove reaction command', error as Error);
        }
        metrics.stop(metricId);
    }
});