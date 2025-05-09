import {
    ApplicationCommandOptionType,
    BaseGuildTextChannel,
    ChannelType,
    GuildTextBasedChannel,
    Message,
    User
} from "discord.js";
import { Command } from "../../structures/command"; 
import { Logger } from "../../logger";
import { databaseManager } from "../../structures/database";
import { config } from "../../const";
import { client } from "../../structures/client";
import { MessagesRecord } from "../../types/database";
import { notificationManager } from "../../functions/notification";
import { NotificationType } from "../../types/event";

const logger = new Logger('EditMessageCmd');

export default new Command({
    name: 'edit-message',
    description: 'Used for editing messages in a network channel.',
    options:
    [{
        name: 'message-id',
        description: 'The id of the message you want to edit.',
        type: ApplicationCommandOptionType.String,
        required: true
    },
    {
        name: 'content',
        description: 'The new content of the edited message',
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
        if (!options.interaction.guild) {
            await options.interaction.reply(`You cant use this here`);
            return;
        }
        const channel = options.interaction.channel as BaseGuildTextChannel;
        if (!channel) {
            await options.interaction.reply({ content: `Could not find channel`, ephemeral: true });
            logger.warn(`Could not find channel`);
            return;
        }
        if (channel.type !== ChannelType.GuildText) return;

        let message: Message<true> | undefined;
        try {
            message = channel.messages.cache.find((channelMessage) => channelMessage.id === options.args.getString('message-id'));
        }
        catch (error) {
            await options.interaction.reply({ content: `There was an error getting the message`, ephemeral: true });
            logger.error(`There was an error getting the message:`, error as Error);
        }

        if (!message) {
            await options.interaction.reply({ content: `Could not get message`, ephemeral: true });
            logger.warn(`Could not get message`);
            return;
        }

        const webhooks = config.activeWebhooks;
        const channelWebhook = webhooks.find((webhook) => webhook.channelId === channel.id);
        if (!channelWebhook) {
            await options.interaction.reply({ content: `No channel webhook.`, ephemeral: true });
            return;
        }
        
        if (config.nonChatWebhooks.includes(channelWebhook.name)) return;
        
        const webhookChannelType = (await databaseManager.getBroadcast(channelWebhook.id))?.channelType;
        if(!webhookChannelType) {
            logger.warn("Could not get webhook channel type.");
            return;
        }

        //DO NOT TOUCH, THIS HOLDS THE WHOLE THING TOGETHER
        //WITHOUT THIS THE COMMAND DOESNT GET REGISTERED AND I DONT KNOW WHY
        //ITS PROBABLY SOME SORT OF JAVASCRIPT MAGIC LEFT IN FROM THE PLAIN JS VERSION
        const messageChannelId = message.channel.id;
        
        //This works
        //relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === messageChannelId);
        
        //This breaks
        //relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === message.channel.id);

        let relatedMessageRecords: MessagesRecord[];
        try {
            relatedMessageRecords = await databaseManager.getMessages(messageChannelId, message.id);
        } catch (error) {
            logger.error(`Could not get messages. Error: `, error as Error);
            return;
        }
        const matchingWebhooks = webhooks.filter(async (webhook) => (await databaseManager.getBroadcast(webhook.id))?.channelType === webhookChannelType);

        if (!(relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === messageChannelId)?.userId === options.interaction.user.id)) {
            await options.interaction.reply({ content: "You do not have permission to edit this message.", ephemeral: true });
            return;
        }

        const oldMessageContent = message.content;

        await Promise.allSettled(matchingWebhooks.map(async (matchingWebhook) => {
            let networkMessage;
            try {
                const networkMessageRecord = relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === matchingWebhook.channelId);
                if (!networkMessageRecord) {
                    await options.interaction.reply({ content: `Could not get network message record`, ephemeral: true });
                    logger.warn(`Could not get network message record`);
                    return;
                }
                const networkChannel = client.channels.cache.find((clientChannel) => clientChannel.id === matchingWebhook.channelId);
                if (!networkChannel) {
                    await options.interaction.reply({ content: `Could not find network channel`, ephemeral: true });
                    logger.warn(`Could not find network channel`);
                    return;
                }
                const guildNetworkChannel = networkChannel as GuildTextBasedChannel;
                networkMessage = guildNetworkChannel.messages.cache.find((guildMessage) => guildMessage.id === networkMessageRecord.channelMessageId);
            }
            catch (error) {
                await options.interaction.reply({ content: `Got an error during getting network message`, ephemeral: true });
                logger.error(`Got an error during getting network message: `, error as Error);
            }
            if (!networkMessage) {
                await options.interaction.reply({ content: `Got an error during getting network message`, ephemeral: true });
                logger.warn(`Could not get network message`);
                return;
            }

            await matchingWebhook.editMessage(networkMessage, { content: options.args.getString('content') });
            await options.interaction.reply({ content: `Successfully edited message.`, ephemeral: true });
        }));
        
        const targetUser = client.users.cache.find((clientUser) => clientUser.id === relatedMessageRecords[0].userId);
        await notificationManager.sendNotification({
            executingUser: targetUser as User,
            targetUser: targetUser,
            channelType: webhookChannelType,
            oldContent: oldMessageContent,
            newContent: options.args.getString('content') ?? undefined,
            notificationType: NotificationType.MESSAGE_EDIT,
            time: Date.now(),
            guild: options.interaction.guild
        });
    }
})