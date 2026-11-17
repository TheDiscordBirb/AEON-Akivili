import { Command } from '../../structures/command';
import { 
    ActionRow,
    ApplicationCommandOptionType, 
    BaseGuildTextChannel, 
    ChannelType, 
    Message, 
    MessageActionRowComponent, 
    PermissionFlagsBits, 
    TextChannel, 
} from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { Logger } from '../../logger';
import { RunOptions } from '../../types/command';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { errorHandler } from '../../structures/error-handler';
import { rebuildMessageComponentAfterUserInteraction } from '../../utils/rebuild-comps';
import { config } from '../../const';
import { clients } from '../../structures/client';
import { EmojiReplacementData } from '../../types/event';
import { replaceEmojis } from '../../utils/emoji';

const logger = new Logger('RemoveReactionCmd');

// TODO: rework, test
const removeReactionChecks = async (options: RunOptions): Promise<void> => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);

    const channel = options.interaction.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);
    
    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: false},
        options.interaction.guild,
        [PermissionFlagsBits.ManageMessages],
        PermissionLevels.REPRESENTATIVE);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral" });
        throw new Error(ErrorNames.NO_PERMISSIONS)
    }

    const messageId = options.args.getString('message-id');
    if (!messageId) throw new Error(ErrorNames.NO_REQUIRED_FIELD);

    const message = channel.messages.cache.get(messageId);
    if (!message) throw new Error(ErrorNames.NO_MESSAGE);

    const messageRecord = (await databaseManager.getMessages(message.id))
        .find((record) => record.discordMessageId === message.id);
    if (!messageRecord) throw new Error(ErrorNames.NO_MESSAGE_IN_DB);

    await removeReactionCommand(options, message)
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
        try {
            await removeReactionChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.REMOVE_REACTION
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const removeReactionCommand = async (
    options: RunOptions, 
    message: Message<boolean>,
) => {
    const interactionReply = await (await options.interaction.reply({ 
            content: 'Click on the reaction you want to remove.',
            components: message.components,
            flags: 'Ephemeral'
        }
    )).fetch();

    interactionReply.createMessageComponentCollector()
    .on('collect', async (buttonInteraction) => {
        const messageUid = databaseManager.getMessageUid(message.id);
        const newActionRows = await rebuildMessageComponentAfterUserInteraction(
            message,
            message.components as ActionRow<MessageActionRowComponent>[],
            { messageUid, userId: options.interaction.user.id, reactionIdentifier: buttonInteraction.customId },
            true
        )
        const relatedMessages = await databaseManager.getMessagesByUid(messageUid);
        const client = clients.find((c) => c.channels.cache.get(relatedMessages[0].channelId));
        if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);    
        const messageContent = message.content;
        let emojiReplacement : EmojiReplacementData | undefined;
        if(messageContent) {
            emojiReplacement = await replaceEmojis(messageContent, client);
        }

        await Promise.allSettled(relatedMessages.map(async (relatedMessage) => {
            const webhook = config.activeWebhooks.find((activeWebhook) => activeWebhook.channelId === relatedMessage.channelId);
            if(!webhook) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK);
            const channel = client.channels.cache.get(relatedMessage.channelId) as TextChannel;
            const message = channel.messages.cache.get(relatedMessage.discordMessageId);
            if(!message) throw new Error(ErrorNames.NO_MESSAGE);
            const broadcastRecord = await databaseManager.getBroadcastByWebhookId(webhook.id);
            if(!broadcastRecord) throw new Error(ErrorNames.NO_BROADCAST_IN_CACHE);
            await webhook.editMessage(relatedMessage.discordMessageId, { content: emojiReplacement?.content, components: [...newActionRows[newActionRows.indexOf(newActionRows.find((actionRow) => actionRow.guildID === broadcastRecord.guildId) || newActionRows[0])].components] });
        }))
    })
}