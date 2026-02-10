import {
    Message,
    EmbedBuilder,
    User,
    Colors,
    Attachment,
    BaseGuildTextChannel
} from 'discord.js';
import { MessagesRecord } from '../types/database';
import { databaseManager } from '../structures/database';
import { Logger } from '../logger';
import { client } from '../structures/client';
import { Time } from './time';

const logger = new Logger("pingUtils");

export const networkChannelPingNotificationEmbedBuilder = async (pingedUserId: string, message: Message, networkMessage: MessagesRecord | undefined, networkUser: User, replyMessage?: MessagesRecord): Promise<{ EmbedBuilder: EmbedBuilder, Attachments: Attachment[] } | undefined> => {
    const pingedUser = client.users.cache.get(pingedUserId);
    if (!pingedUser) {
        logger.warn(`Could not find user with id ${pingedUserId}`);
    }

    const pingNotificationEmbed = new EmbedBuilder()
        .setAuthor({ name: `${networkUser.displayName} | ${networkUser.id}`, iconURL: networkUser.avatarURL() ?? undefined })
        .setTimestamp(Date.now())
        .setColor(Colors.Yellow)
    
    if (replyMessage) {
        pingNotificationEmbed.setTitle(`You got replied to.`)
    } else {
        pingNotificationEmbed.setTitle(`You got pinged.`);
    }

    pingNotificationEmbed.setDescription(message.content);
    const attachments: Attachment[] = [];
    message.attachments.forEach((attachment) => attachments.push(attachment));

    const pingedUserMessages = await databaseManager.getUniqueUserMessages(pingedUserId, 50);
    if (!pingedUserMessages.length) {
        logger.warn(`Can not get message of pinged user`);
        return { EmbedBuilder: pingNotificationEmbed, Attachments: attachments};
    }
    const pingedUserLastMessage = pingedUserMessages[0];
    if(Date.now() - pingedUserLastMessage.timestamp <= Time.minutes(10)) {
        return undefined;
    }
    let messageToLinkTo: MessagesRecord | undefined;
    if (!networkMessage) {
        logger.warn(`Can not get network message`);
        return { EmbedBuilder: pingNotificationEmbed, Attachments: attachments};
    }
    const relatedNetworkMessages = await databaseManager.getMessagesByUid(networkMessage.userMessageId);
    if (replyMessage) {
        const replyMessageInCorrectGuild = pingedUserMessages.find((pingedUserMessage) => pingedUserMessage.userMessageId === replyMessage.userMessageId);
        if (!replyMessageInCorrectGuild) {
            logger.warn(`Can not get reply message in correct guild`);
            return { EmbedBuilder: pingNotificationEmbed, Attachments: attachments};
        }
        messageToLinkTo = relatedNetworkMessages.find((relatedNetworkMessage) => relatedNetworkMessage.channelId === replyMessageInCorrectGuild.channelId);
    } else {
        messageToLinkTo = relatedNetworkMessages.find((relatedNetworkMessage) => pingedUserLastMessage.channelId === relatedNetworkMessage.channelId);
    }
    
    if (!messageToLinkTo) {
        logger.warn(`Can not get message to link to`);
        return { EmbedBuilder: pingNotificationEmbed, Attachments: attachments};
    }
    const messageGuild = client.guilds.cache.get(messageToLinkTo.guildId);
    const messageChannel = (messageGuild?.channels.cache.get(messageToLinkTo.channelId) as BaseGuildTextChannel);
    const messageMessage = messageChannel.messages.cache.get(messageToLinkTo.channelMessageId);
    if (!messageMessage) {
        logger.warn(`Can not get message`);
        return { EmbedBuilder: pingNotificationEmbed, Attachments: attachments};
    }
    const messageLink = messageMessage.url;
    if (!messageLink) {
        logger.warn(`Can not get message link`);
        return { EmbedBuilder: pingNotificationEmbed, Attachments: attachments};
    }
    pingNotificationEmbed.addFields({ name: "Link to message:", value: messageLink });

    return { EmbedBuilder: pingNotificationEmbed, Attachments: attachments};
}