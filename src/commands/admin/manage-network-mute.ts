import { Command } from '../../structures/command';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { Logger } from '../../logger';
import { client } from '../../structures/client';
import { config } from '../../const';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';

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
    },
    {
        name: 'anonymous-dm',
        description: 'Makes the mute notification anonymous.',
        type: ApplicationCommandOptionType.Boolean,
        required: false
    }],

    run: async (options) => {
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }

        const permissionCheck = await permissionHandler.checkForPermission(
            options.interaction.user,
            {local: true, onlyLocal: false},
            options.interaction.guild,
            [PermissionFlagsBits.MuteMembers],
            PermissionLevels.REPRESENTATIVE);
            
        if(!permissionCheck.status) {
            await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral"});
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

        const userMutedState = await databaseManager.hasUserBeenMutedOnNetworkChat(userId);
        if ((await databaseManager.whoMutedUser(userId)) == config.birbId && options.interaction.user.id != config.birbId) {
            await options.interaction.reply({ content: `${user ? user : "User"} can not be unmuted as they were muted by Birb` });
            return;
        }
        
        await databaseManager.toggleNetworkChatMute(userId, options.interaction.user.id);
        await options.interaction.reply({ content: `${user ? user : "User"} has been ${userMutedState ? "un" : ""}muted`, ephemeral: true });
        if (user) {
            if (!user.dmChannel) {
                user.createDM();
            }
            let muteInfo = `\nTo dispute this join https://discord.gg/bAmwkDYZ5e and open a modmail by sending <@989173789482975262> a message.`;
            if (!options.args.get('anonymous-dm')) {
                muteInfo = `by ${options.interaction.user.username}` + muteInfo;
            }
            await user.send(`You have been ${userMutedState ? "un" : ""}muted on the Aeon Network channels ${userMutedState ? "" : muteInfo}`);
        }
    }
});