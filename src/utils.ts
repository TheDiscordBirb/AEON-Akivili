import {
    ActivityType,
    GuildMember,
    PermissionFlagsBits,
    ActionRow,
    MessageActionRowComponent,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonComponent,
    ButtonStyle,
    Collection,
    OAuth2Guild,
    Message,
    EmbedBuilder,
    APIEmbedField,
    User,
    GuildTextBasedChannel,
    Client,
    GuildEmoji,
    Colors,
    Attachment,
    BaseGuildTextChannel
} from 'discord.js';
import { MessagesRecord, UserReactionRecord } from './types/database';
import { databaseManager } from './structures/database';
import { ActionRowComponentReconstructionData, CustomId, EmojiReplacementData, guildEmojiCooldowns } from './types/event';
import { Logger } from './logger';
import { client } from './structures/client';
import axios from 'axios';
import { config } from './const';
import { clientInfoData } from './types/client';
import sharp from 'sharp';

const logger = new Logger("Utils");

export const clientInfo = (): clientInfoData => {
    let clientName = client.user?.username;
    let clientAvatarUrl = client.user?.avatarURL();
    if (!clientName) {
        logger.warn("Could not get client username, has been set to 'Akivili'");
        clientName = "Akivili";
    }
    if (!clientAvatarUrl) {
        logger.warn("Could not get client avatar, has been set to undefined");
        clientAvatarUrl = undefined;
    }
    return { name: clientName, avatarUrl: clientAvatarUrl }
}

export const hasModerationRights = (guildUser: GuildMember): boolean => {
    return !!(guildUser.roles.cache.find((role) => role.permissions.has(PermissionFlagsBits.BanMembers)));
}
export const hasMessageManageRights = (guildUser: GuildMember): boolean => {
    return !!(guildUser.roles.cache.find((role) => role.permissions.has(PermissionFlagsBits.ManageMessages)));
}

export const isNavigator = (user: User): boolean => {
    const aeonGuild = (client.channels.cache.get(config.aeonBanshareChannelId) as GuildTextBasedChannel).guild;
    const aeonMember = aeonGuild.members.cache.get(user.id);
    if (!aeonMember) return false;
    return !!aeonMember.roles.cache.get(config.navigatorRoleId);
}
export const isConductor = (user: User): boolean => {
    const aeonGuild = (client.channels.cache.get(config.aeonBanshareChannelId) as GuildTextBasedChannel).guild;
    const aeonMember = aeonGuild.members.cache.get(user.id);
    if (!aeonMember) return false;
    return !!aeonMember.roles.cache.get(config.conductorRoleId);
}
export const isDev = (user: User): boolean => {
    return !!config.devIds.includes(user.id);
}
export const doesUserOwnMessage = (userIdInDb: string | undefined, userId: string): boolean => {
    return userIdInDb === userId;
}
export const userActivityLevelCheck = async (userId: string): Promise<number> => {
    try {
        const coinTierMessage = (await databaseManager.getUniqueUserMessages(userId, 1, 100))[0];
        const diamondTierMessage = (await databaseManager.getUniqueUserMessages(userId, 1, 200))[0];
        const crownTierMessage = (await databaseManager.getUniqueUserMessages(userId, 1, 300))[0];
        return (Date.now() - coinTierMessage.timestamp <= Time.hours(48) ? (Date.now() - diamondTierMessage.timestamp <= Time.hours(48) ? (Date.now() - crownTierMessage.timestamp <= Time.hours(48) ? 3 : 2) : 1) : 0);
    } catch {
        logger.warn("Could not get user messages.");
        return 0;
    }
}

export namespace Time {
    export const SECOND = 1000;
    export const MINUTE = 60 * SECOND;
    export const HOUR = 60 * MINUTE;
    export const DAY = 24 * HOUR;
    export const WEEK = 7 * DAY;
    export const seconds = (quantity: number) => SECOND * quantity;
    export const minutes = (quantity: number) => MINUTE * quantity;
    export const hours = (quantity: number) => HOUR * quantity;
    export const days = (quantity: number) => DAY * quantity;
    export const weeks = (quantity: number) => WEEK * quantity;
}

export const sleep = (ms: number)  => new Promise(resolve => setTimeout(resolve, ms))

export const asyncRetry = async <T>(f: () => Promise<T>, retryCount = 5): Promise<T> => {
    try {
        const result = await f();
        return result;
    } catch (error) {
        if (retryCount > 0) {
            await sleep(250);
            return asyncRetry(f);
        }
        throw Error(`Retries failed. Error: ${(error as Error).message}`);
    }
}

export const rebuildMessageComponentAfterUserInteraction = async (message: Message<boolean>, component: ActionRow<MessageActionRowComponent>[], userReactionRecord: UserReactionRecord, deleteAll = false): Promise<ActionRowComponentReconstructionData[]> => {
    const hasUserReactedToMessage = await databaseManager.hasUserReactedToMessage(userReactionRecord);
    const hasReplyRow = component[0]?.components[0].customId === CustomId.REPLY;
    const firstEmojiRow = hasReplyRow ? 1 : 0;
    const emojiRows = component.slice(firstEmojiRow, component.length);
    const buttonComponents = emojiRows.flatMap((actionRow) => {
        return actionRow.components.flatMap((actionRowComponent) => {
            return actionRowComponent as ButtonComponent;
        })
    });
    
    let emojiFoundInActionRows = false;
    const newButtonComponents = buttonComponents.reduce<ButtonBuilder[]>((acc, buttonComponent) => {
        if (!buttonComponent.customId) {
            logger.warn(`No button component id`);
            return acc;
        }
        if (!buttonComponent.emoji) {
            logger.warn(`No button component emoji`);
            return acc;
        }
        if (!buttonComponent.label) {
            logger.warn(`No button component label`);
            return acc;
        }
        const buttonLabelNumber = parseInt(buttonComponent.label);
        if (isNaN(buttonLabelNumber)) {
            logger.warn(`No button component label as number (label: ${buttonComponent.label})`);
            return acc;
        }

        const newButton = new ButtonBuilder()
            .setCustomId(buttonComponent.customId)
            .setEmoji(buttonComponent.emoji)
            .setStyle(buttonComponent.style);

        let label;
        if (buttonComponent.customId === userReactionRecord.reactionIdentifier) {
            emojiFoundInActionRows = true;
            if (deleteAll) return acc;
            const count = buttonLabelNumber + (hasUserReactedToMessage ? -1 : 1);
            if (count === 0) {
                return acc;
            }
            label = count.toString()
        } else {
            label = buttonLabelNumber.toString();
        }
            
        newButton.setLabel(label);
        acc.push(newButton);
        return acc;
    }, []);
    
    if (!emojiFoundInActionRows) {
        const newButton = new ButtonBuilder()
            .setCustomId(userReactionRecord.reactionIdentifier)
            .setEmoji(userReactionRecord.reactionIdentifier)
            .setStyle(ButtonStyle.Secondary)
            .setLabel("1");
            
        newButtonComponents.push(newButton);
    }
    
    let messageUid = await databaseManager.getMessageUid(message.channel.id, message.id);
    const repliedMessage = (message.components[0].components[1] as ButtonComponent).url;
    if(repliedMessage) {
        const repliedMessageLinkRegex = /https:\/\/discord.com\/channels\/[0-9]*\/([0-9]*)\/([0-9]*)/gm;
        const repliedMessageArgs = repliedMessageLinkRegex.exec(repliedMessage);
        if(repliedMessageArgs) {
            messageUid = await databaseManager.getMessageUid(repliedMessageArgs[1], repliedMessageArgs[2]);
        }

    }
    const relatedNetworkMessages = await databaseManager.getMessagesByUid(messageUid);
    const returnValues: ActionRowComponentReconstructionData[] = [];

    await Promise.allSettled(relatedNetworkMessages.flatMap(async (messagesRecord) => {
        const resultComponent: ActionRowBuilder<ButtonBuilder>[] = [];
    
        if (hasReplyRow) {
            const replyButtons: ButtonBuilder[] = [];
            component[0].components.forEach((replyComponent) => {
                const replyButton = replyComponent as ButtonComponent;
                const url = repliedMessage ? ((replyComponent as ButtonComponent).url ? `https://discord.com/channels/${messagesRecord.guildId}/${messagesRecord.channelId}/${messagesRecord.channelMessageId}` : replyButton.url) : replyButton.url;
                const customId = replyButton.customId;
                const emoji = replyButton.emoji;
                if (!replyButton.label) {
                    logger.warn(`No reply button label`);
                    return;
                }
    
                const replyButtonBuilder = new ButtonBuilder()
                    .setStyle(replyButton.style)
                    .setLabel(replyButton.label)
                    .setDisabled(replyButton.disabled);
                if (url) {
                    replyButtonBuilder.setURL(url);
                }
                if (customId) {
                    replyButtonBuilder.setCustomId(customId);
                }
                if (emoji) {
                    replyButtonBuilder.setEmoji(replyButton.emoji);
                }
                replyButtons.push(replyButtonBuilder);
            })
            const replyRow = new ActionRowBuilder<ButtonBuilder>();
            resultComponent.push(replyRow);
            resultComponent[resultComponent.length - 1].addComponents(replyButtons);
        }
    
        const maxRowCount = 5 - firstEmojiRow;
        newButtonComponents.forEach((newButtonComponent, idx) => {
            const row = Math.floor(idx / 5);
            if (row > maxRowCount) {
                logger.warn(`More rows than max row count`);
                return;
            }
            if (row >= resultComponent.length - (hasReplyRow ? 1 : 0)) {
                const newActionRow = new ActionRowBuilder<ButtonBuilder>();
                resultComponent.push(newActionRow);
            }
            resultComponent[resultComponent.length - 1].addComponents(newButtonComponent);
        });
        returnValues.push({guildID: messagesRecord.guildId, components: resultComponent});
    }))

    if (deleteAll) {
        try {
            await databaseManager.deleteReaction(userReactionRecord);
        } catch (error) {
            logger.error(`Got error while deleting reactions.`, (error as Error));
        }
    } else {
        await databaseManager.toggleUserReaction(userReactionRecord);
    }
    return returnValues;
}

export const statusUpdate = async (guilds: Collection<string, OAuth2Guild>): Promise<void> => {
    let memberObjects: Collection<string, GuildMember> = new Collection();
    let guildCount = 0;
    const broadcasts = await databaseManager.getBroadcasts();
    for await (const oauthGuild of guilds) {
        const guild = client.guilds.cache.find((guild) => guild.id === oauthGuild[0]);
        if (!guild) continue;
        const guildBroadcasts = broadcasts.filter((broadcast) => broadcast.guildId === guild.id);
        if (!guildBroadcasts.length) continue;

        guildCount++;
        memberObjects = memberObjects.concat(guild.members.cache);
    }

    if (!client.user) {
        logger.wtf(`No client user.`);
        return;
    }

    client.user.setPresence({
        activities: [{
            name: `over ${memberObjects.size} trailblazers in ${guildCount} train cars`,
            type: ActivityType.Watching
        }],
        status: 'online'
    });
    return;
}

export const rebuildNetworkInfoEmbeds = async (message: Message, name?: string, link?: string, remove = false): Promise<EmbedBuilder[]> => {
    const embeds: EmbedBuilder[] = [];

    if (!message) {
        throw Error('No message to rebuild network info embeds');
    }
    const messageEmbeds = message.embeds;
    
    messageEmbeds.flatMap(async (embed) => {
        if ((!embed.description) || (!embed.description.includes('AEON MEMBERS'))) {
            embeds.push(new EmbedBuilder({ ...embed.data, title: embed.title ?? undefined, description: embed.description ?? undefined }));
            return;
        }

        const networkServerStrings = embed.fields.flatMap((field) => field.value.split(/\n/));

        if (remove) { 
            if (link) {
                const removeNetworkIdx = networkServerStrings.findIndex((serverString) => serverString.includes(link));
                networkServerStrings.splice(removeNetworkIdx, 1);
            } else if (name) {
                const removeNetworkIdx = networkServerStrings.findIndex((serverString) => serverString.includes(name));
                networkServerStrings.splice(removeNetworkIdx, 1);
            } else {
                return;
            }
        } else {
            if (link && name) {
                networkServerStrings.push(`★・[${name}](${link})`);
            }
        }
        
        const editedEmbed = new EmbedBuilder({ ...embed.data });

        const getFirstLetter = (input: string): string | null => {
            return /\b[a-zA-Z]/gi.exec(input)?.toString() ?? null;
        }

        let columnIdx = 0;
        let columnRanges: {from: string, to: string}[] = [];
        const networkServerColumns: string[] = networkServerStrings.sort().reduce<string[]>((acc, serverString) => {
            if (!acc[columnIdx]) {
                acc[columnIdx] = serverString;
                columnRanges[columnIdx] = { from: getFirstLetter(serverString) ?? 'A', to: ''};
                return acc;
            } else {
                const newAccColumnValue = `${acc[columnIdx]}\n${serverString}`;
                columnRanges[columnIdx].to = getFirstLetter(serverString) ?? columnRanges[columnIdx]?.from ?? '';
                if (newAccColumnValue.length <= config.maxEmbedColumnValueLength) {
                    acc[columnIdx] = newAccColumnValue;
                    return acc;
                }
                acc[++columnIdx] = serverString;
                const fromLetter = getFirstLetter(acc[columnIdx]);
                const toLetter = getFirstLetter(serverString);
                const previousToLetter = String.fromCharCode(columnRanges[columnIdx-1]?.to.charCodeAt(0)+1) ?? undefined;
                columnRanges[columnIdx] = { from: fromLetter ?? 'A', to: previousToLetter || toLetter || ''};
                return acc;
            }
        }, []);
        
        const networkFields: APIEmbedField[] = networkServerColumns.flatMap((column, idx) => {
            return { name: `Characters (${columnRanges[idx].from} - ${columnRanges[idx].to})`, value: column, inline: true };
        })

        editedEmbed.setFields(networkFields);
        embeds.push(editedEmbed);
    });
    return embeds;
}

export const replaceEmojis = async (content: string, client: Client): Promise<EmojiReplacementData> => {
    const emoteCapture = /(a?):([^:]+):(\d+)/g;
    const extractedEmojiData: string[][] = [];
    let currentEmojiCapture = emoteCapture.exec(content);
    while (currentEmojiCapture) {
        const currentEmojiData = [currentEmojiCapture[1], currentEmojiCapture[2], currentEmojiCapture[3]];
        if (!extractedEmojiData.find((data) => data[2] === currentEmojiData[2])) {
            extractedEmojiData.push(currentEmojiData);
        }
        currentEmojiCapture = emoteCapture.exec(content);
    };
    
    const emojis: GuildEmoji[] = [];
    guildEmojiCooldowns.forEach(async (guildEmojiCooldown, cooldownsIdx) => {
        if (guildEmojiCooldowns.length === 0) return;
        guildEmojiCooldown.forEach(async (cooldown, cooldownIdx) => {
            if (cooldownIdx === 0) return;
            const cooldownInt = parseInt(cooldown);
            if (isNaN(cooldownInt)) {
                logger.warn(`Got a NaN instead of Int: ${cooldown}`);
                guildEmojiCooldown.splice(cooldownIdx, 1);
                return;
            }
            if (Date.now() >= cooldownIdx) {
                guildEmojiCooldown.splice(cooldownIdx, 1);
                return;
            }
        });
        if (guildEmojiCooldown.length <= 1) {
            guildEmojiCooldowns.splice(cooldownsIdx);
            return;
        }
    });
  
    await Promise.allSettled(extractedEmojiData.map(async (emoji, idx) => {
        if (client.emojis.cache.get(emoji[2])) return;
            
        if (guildEmojiCooldowns.length === 0 || guildEmojiCooldowns[guildEmojiCooldowns.length - 1].length >= config.maxEmojiPerServer + 1) {
            if (guildEmojiCooldowns.length >= config.emojiServerIds.length) {
                return;
            }
            guildEmojiCooldowns.push([`${config.emojiServerIds[guildEmojiCooldowns.length ? guildEmojiCooldowns.length - 1 : 0]}`]);
        }

        const guildId = guildEmojiCooldowns[guildEmojiCooldowns.length - 1][0];
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        const url = `https://cdn.discordapp.com/emojis/${emoji[2]}.${emoji[0] ? "gif" : "png"}?v=1`;
        const attachmentBuffer = await axios.get(url, { responseType: 'arraybuffer' });
        const attachment = Buffer.from(attachmentBuffer.data, 'utf-8');
        await guild.emojis.create({ attachment, name: emoji[1] }).then((emoji) => {
            guildEmojiCooldowns[guildEmojiCooldowns.length - 1].push(`${Date.now() + Time.HOUR}`);
            emojis.push(emoji);
        });
    }));
    let messageContent = content;
    emojis.forEach(async (emoji) => {
        const regex = new RegExp(`<a?:${emoji.name}:\\d+>`, "g");
        messageContent = messageContent.replaceAll(regex, `${emoji}`);
    })
    return { content: messageContent, emojis: emojis };
}

export const watermarkSize = async (metadata: sharp.Metadata, pages: number): Promise<number> => {
    //Do not ask, it works, not gonna fuck around anymore
    return 0.0000760966078036 * (metadata.width! * (metadata.height! / pages)) + 15.71281;
}

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