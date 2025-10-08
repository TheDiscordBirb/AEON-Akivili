import { Colors, EmbedBuilder, Emoji, GuildTextBasedChannel } from "discord.js";
import { NotificationData } from "../types/notification";
import { NotificationType } from "../types/event";
import { client } from "../structures/client";
import { config } from "../const";
import { Logger } from "../logger";

const logger = new Logger("Notification");


class NotificationManager {
    public async sendNotification(data: NotificationData) {
        const notificationChannel = client.channels.cache.find((clientChannel) => clientChannel.id === (data.privateNotification ? config.privateNotificationChannelId : config.publicNotificationChannelId ));
        if (!notificationChannel) {
            logger.warn(`No notification channel found`);
            return;
        }

        const embedCollection: EmbedBuilder[] = [];

        const notificationEmbed = new EmbedBuilder()
            .setAuthor({ name: `${data.executingUser.username} (${data.executingUser.id})`, iconURL: data.executingUser.avatarURL() ?? undefined })
            .setFooter({ text: `Aeon ${data.channelType} | ${new Date(data.time).toLocaleString('en-US',{ hourCycle: "h12" })}` });

        switch (data.notificationType) {
            case NotificationType.BAN: {
                if (!data.targetUser) {
                    logger.warn(`Couldnt get target user`);
                    return;
                }
                if (!data.message) {
                    logger.warn(`Couldnt get message`);
                    return;
                }
                notificationEmbed.setTitle(`${data.targetUser.username} has been banned in "${data.guild.name}"`);
                notificationEmbed.addFields({ name: `${data.targetUser.username} (${data.targetUser.id}) said:`, value: `${data.message.content}` });
                notificationEmbed.setColor(Colors.Red);
                embedCollection.push(notificationEmbed);
                break;
            }
            case NotificationType.MODERATOR_BAN: {
                if (!data.targetUser) {
                    logger.warn(`Couldnt get target user`);
                    return;
                }
                if (!data.message) {
                    logger.warn(`Couldnt get message`);
                    return;
                }
                notificationEmbed.setTitle(`${data.targetUser.username} has moderator rights and has been banned in "${data.guild.name}"`);
                notificationEmbed.addFields({ name: `${data.targetUser.username} (${data.targetUser.id}) said:`, value: `${data.message.content}` });
                notificationEmbed.setColor(Colors.DarkRed);
                break;
            }
            case NotificationType.MESSAGE_DELETE: {
                if (!data.targetUser) {
                    logger.warn(`Couldnt get target user`);
                    return;
                }
                if (!data.message) {
                    logger.warn(`Couldnt get message`);
                    return;
                }
                notificationEmbed.setTitle(`Message has been deleted by ${data.deletedByMod ? "a moderator" : "user"} (${data.guild.name})`);
                notificationEmbed.addFields({ name: `Message:`, value: data.message.content ? data.message.content : '"No message content"' });
                notificationEmbed.setColor(Colors.Yellow);
                if (data.message.attachments.size) {
                    notificationEmbed.setDescription(`This message also contained ${data.message.attachments.size} media attachment, but ${(data.message.attachments.size === 1) ? 'it' : 'they'} cannot be loaded`);
                }
                embedCollection.push(notificationEmbed);
                break;
            }
            case NotificationType.MESSAGE_EDIT: {
                if (!data.targetUser) {
                    logger.warn(`Couldnt get target user`);
                    return;
                }
                notificationEmbed.setTitle(`Message has been edited (${data.guild.name})`);
                notificationEmbed.addFields({
                    name: `Old message:`,
                    value: data.oldContent ? data.oldContent : '"No message content"'
                },
                {
                    name: `New message:`,
                    value: data.newContent ? data.newContent : '"No message content"'
                });
                data.deletedByMod ? notificationEmbed.setColor(Colors.DarkBlue) : notificationEmbed.setColor(Colors.Blue);
                embedCollection.push(notificationEmbed);
                break;
            }
            case NotificationType.REACTION_DELETE: {
                // TODO
                break;
            }
            case NotificationType.MUTE: {
                // TODO
                break;
            }
            case NotificationType.PIN: {
                // TODO
                break;
            }
            case NotificationType.CROWD_CONTROL: {
                // TODO
                break;
            }
            case NotificationType.SERVER_DISCONNECT: {
                // TODO
                break;
            }
            case NotificationType.SERVER_REMOVE: {
                // TODO
                break;
            }
            case NotificationType.SERVER_JOIN: {
                if(!data.guildData) {
                    logger.warn('Didnt get guild data.');
                    return;
                }
                notificationEmbed.setTitle(`Bot has been added to ${data.guild.name}`);
                notificationEmbed.setDescription(`Server has ${data.guildData.guildChannels.size} channels and ${data.guildData.guildMembers.size} members.`);
                notificationEmbed.setColor(Colors.DarkPurple);
                embedCollection.push(notificationEmbed);
                break;
            }
            case NotificationType.FILTERED_MESSAGE: {
                if(!data.filteredWords) {
                    logger.warn('Didnte get filtered words.');
                    return;
                }
                notificationEmbed.setTitle(`A message has been filtered from ${data.guild.name}`);
                notificationEmbed.setDescription(`${data.executingUser} has said the following:\n${data.filteredWords.join(", ")}`);
                notificationEmbed.setColor(Colors.Orange);
                embedCollection.push(notificationEmbed);

                break;
            }
        }

        await (notificationChannel as GuildTextBasedChannel).send({ embeds: embedCollection });
    }
}

export const notificationManager = new NotificationManager();
