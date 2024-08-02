import {
    ApplicationCommandOptionType,
    BaseGuildTextChannel,
    ChannelType,
    GuildTextBasedChannel,
    WebhookClient,
    Message
} from "discord.js";
import { Command } from "../../structures/command"; 
import { Logger } from "../../logger";
import { databaseManager } from "../../structures/database";
import { config } from "../../const";
import { client } from "../../structures/client";
import { doesUserOwnMessage, hasModerationRights } from "../../utils";

const logger = new Logger('DeleteMessageCmd');

export default new Command({
    name: 'delete-message',
    description: 'Used for deleting messages in a network channel.',
    options:
    [{
        name: 'message-id',
        description: 'The id of the message you want to edit.',
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
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

        let webhooks;
        try {
            webhooks = await channel.fetchWebhooks();
        } catch (error) { 
            await options.interaction.reply({ content: `Could not fetch webhooks in guild`, ephemeral: true });
            logger.error(`Could not fetch webhooks in guild: ${message.guild.name ?? 'Unknown'} channel: ${channel.name ?? 'Unknown'}`, error as Error)
            return;
        };

        const broadcastRecords = await databaseManager.getBroadcasts();
        const broadcastWebhookIds = broadcastRecords.map((broadcast) => broadcast.webhookId);
        const webhook = webhooks.find((webhook) => broadcastWebhookIds.includes(webhook.id));
        
        if (!webhook) return;
        if (config.nonChatWebhooks.includes(webhook.name)) return;
        
        const webhookNameParts = webhook.name.split(' ');
        const webhookChannelType = webhookNameParts[webhookNameParts.length - 1];

        //DO NOT TOUCH, THIS HOLDS THE WHOLE THING TOGETHER
        //WITHOUT THIS THE COMMAND DOESNT GET REGISTERED AND I DONT KNOW WHY
        //ITS PROBABLY SOME SORT OF JAVASCRIPT MAGIC LEFT IN FROM THE PLAIN JS VERSION
        const messageChannelId = message.channel.id;
        
        //This works
        //relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === messageChannelId);
        
        //This breaks
        //relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === message.channel.id);
        
        const relatedMessageRecords = await databaseManager.getMessages(messageChannelId, message.id);
        const matchingBroadcastRecords = (await databaseManager.getBroadcasts()).filter((broadcast) => broadcast.channelType === webhookChannelType);

        if(!hasModerationRights(options.interaction.member)) {
            if (!doesUserOwnMessage(relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === messageChannelId)?.userId, options.interaction.user.id)) {
                await options.interaction.reply({ content: "You do not have permission to delete this message.", ephemeral: true });
                return;
            }
            
        }

        await Promise.allSettled(matchingBroadcastRecords.map(async (matchingBroadcastRecord) => {
            let networkMessage;
            try {
                const networkMessageRecord = relatedMessageRecords.find((relatedMessage) => relatedMessage.channelId === matchingBroadcastRecord.channelId);
                if (!networkMessageRecord) {
                    await options.interaction.reply({ content: `Could not get network message record`, ephemeral: true });
                    logger.warn(`Could not get network message record`);
                    return;
                }
                const networkChannel = client.channels.cache.find((clientChannel) => clientChannel.id === matchingBroadcastRecord.channelId);
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
            const webhookClient = new WebhookClient({ id: matchingBroadcastRecord.webhookId, token: matchingBroadcastRecord.webhookToken });

            await webhookClient.deleteMessage(networkMessage);
            await options.interaction.reply({ content: `Successfully deleted message.`, ephemeral: true });
        }))
    }
})