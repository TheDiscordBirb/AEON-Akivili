import { Colors, EmbedBuilder, Emoji, GuildTextBasedChannel } from "discord.js";
import { NotificationData } from "../structures/types";
import { NotificationType } from "../types/event";
import { client } from "../structures/client";
import { config } from "../const";
import { Logger } from "../logger";

const logger = new Logger("Notification");


class NotificationManager {
    public async sendNotification(data: NotificationData) {
        const notificationChannel = client.channels.cache.find((clientChannel) => clientChannel.id === config.notificationChannelId);
        if (!notificationChannel) {
            logger.warn(`No notification channel found`);
            return;
        }

        const embedCollection: EmbedBuilder[] = [];

        const notificationEmbed = new EmbedBuilder()
            .setAuthor({ name: data.executingUser.username, iconURL: data.executingUser.avatarURL() ?? undefined })
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
                if (data.images) {
                    notificationEmbed.setTitle(`${data.targetUser.username} has been banned in "${data.guild.name}" with a banshare request`)
                    notificationEmbed.setURL(`https://discord.com/users/${data.targetUser.id}`);
                    embedCollection.push(notificationEmbed);
                    embedCollection.push(...data.images.map((image) => {
                        return new EmbedBuilder()
                        .setURL(`https://discord.com/users/${data.targetUser?.id}`)
                        .setImage(image);
                    }));    
                    break;
                }
                embedCollection.push(notificationEmbed);
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
                if (!data.oldContent) {
                    logger.warn(`Couldnt get old content`);
                    return;
                }
                if (!data.newContent) {
                    logger.warn(`Couldnt get new content`);
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
        }

        await (notificationChannel as GuildTextBasedChannel).send({ embeds: embedCollection });
    }
}

export const notificationManager = new NotificationManager();