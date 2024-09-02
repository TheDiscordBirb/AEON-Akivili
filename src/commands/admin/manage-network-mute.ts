import { Command } from '../../structures/command';
import { ApplicationCommandOptionType} from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { hasModerationRights } from '../../utils';
import { Logger } from '../../logger';
import { client } from '../../structures/client';

const logger = new Logger('GetUidCmd');

export default new Command({
    name: 'manage-network-mute',
    description: "Mutes or unmutes a user on the aeon network channels",
    options:
    [{
        name: 'message-id',
        description: 'The id of the message you want to get the uid of.',
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
        const guildMember = options.interaction.guild?.members.cache.find(m => m.id === options.interaction.member.user.id);

        if (!guildMember) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }

        if (!hasModerationRights(guildMember)) {
            await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
            return;
        }
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }

        if (!options.interaction.channel) {
            logger.wtf(`${options.interaction.member.user.username} has used a command without a channel.`);
            return;
        }

        const messageId = options.args.getString('message-id');
        if (!messageId) {
            logger.warn(`${options.interaction.member.user.username} has used a command without the required field 'message-id'.`);
            await options.interaction.reply({ content: 'No message id provided.', ephemeral: true });
            return;
        }
        let userId: string;
        try {
            userId = await databaseManager.getUserId(options.interaction.channel.id, messageId);
        } catch (error) {
            const user = client.users.cache.get(messageId);
            if (user) {
                userId = user.id;
            } else {
                await options.interaction.reply({ content: 'There was an error fetching this user.', ephemeral: true });
                logger.error(`There was an error fetching this user: ${messageId}`, error as Error);
                return;
            }
        }
        const user = client.users.cache.get(userId);

        await databaseManager.toggleNetworkChatMute(userId);
        const userMutedState = await databaseManager.hasUserBeenMutedOnNetworkChat(userId);
        await options.interaction.reply({ content: `${user ? user : "User"} has been ${userMutedState ? "" : "un"}muted`, ephemeral: true });
        if (user) {
            if (!user.dmChannel) {
                user.createDM();
            }
            await user.send(`You have been ${userMutedState ? "" : "un"}muted on the Aeon Network channels by ${options.interaction.user.username}`);
        }
    }
});