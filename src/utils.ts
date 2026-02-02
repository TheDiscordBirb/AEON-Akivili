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
import { cacheManager } from './structures/memcache';
import { ParsedEmoji } from './types/utils';
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
    if(config.suspendedPermissionUserIds.includes(guildUser.id)) {
        return false;
    }
    return !!(guildUser.roles.cache.find((role) => role.permissions.has(PermissionFlagsBits.BanMembers)));
}
export const hasMessageManageRights = (guildUser: GuildMember): boolean => {
    if(config.suspendedPermissionUserIds.includes(guildUser.id)) {
        return false;
    }
    return !!(guildUser.roles.cache.find((role) => role.permissions.has(PermissionFlagsBits.ManageMessages)));
}

export const isNavigator = (user: User): boolean => {
    const aeonGuild = (client.channels.cache.get(config.aeonBanshareChannelId) as GuildTextBasedChannel).guild;
    const aeonMember = aeonGuild.members.cache.get(user.id);
    if(config.suspendedPermissionUserIds.includes(user.id)) {
        return false;
    }
    if (!aeonMember) return false;
    return !!aeonMember.roles.cache.get(config.navigatorRoleId);
}
export const isConductor = (user: User): boolean => {
    const aeonGuild = (client.channels.cache.get(config.aeonBanshareChannelId) as GuildTextBasedChannel).guild;
    const aeonMember = aeonGuild.members.cache.get(user.id);
    if(config.suspendedPermissionUserIds.includes(user.id)) {
        return false;
    }
    if (!aeonMember) return false;
    return !!aeonMember.roles.cache.get(config.conductorRoleId);
}
export const isDev = (user: User): boolean => {
    if(config.suspendedPermissionUserIds.includes(user.id)) {
        return false;
    }
    return !!config.devIds.includes(user.id);
}
export const isRep = async (user: User): Promise<boolean> => {
    const mainServer = client.guilds.cache.get(config.mainServerId);
    if(!mainServer) {
        logger.warn("Could not get main server.");
        return false;
    }
    const serverUser = await mainServer.members.fetch({user});
    if(!serverUser) return false;
    if(serverUser.roles.cache.get(config.representativeRoleId)) {
        if(config.suspendedPermissionUserIds.includes(serverUser.id)) {
            return false;
        }
        return true;
    }
    return false;
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
    } catch(error) {
        if((error as Error).message !== "User does not have enough messages.") {
            logger.error("Got error:", error as Error)
        }
        return 0;
    }
}

export namespace Time {
    export const SECOND = 1000;
    export const MINUTE = 60 * SECOND;
    export const HOUR = 60 * MINUTE;
    export const DAY = 24 * HOUR;
    export const WEEK = 7 * DAY;
    export const YEAR = 365.25 * DAY;
    export const MONTH = YEAR/12;
    export const seconds = (quantity: number) => SECOND * quantity;
    export const minutes = (quantity: number) => MINUTE * quantity;
    export const hours = (quantity: number) => HOUR * quantity;
    export const days = (quantity: number) => DAY * quantity;
    export const weeks = (quantity: number) => WEEK * quantity;
    export const years = (quantity: number) => YEAR * quantity;
    export const months = (quantity: number) => MONTH * quantity;
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
    let repliedMessageUrl = null;
    if(message.components.length) {
        if(hasReplyRow) {
            repliedMessageUrl = ((message.components[0] as ActionRow<MessageActionRowComponent>).components[1] as ButtonComponent).url;
            if(repliedMessageUrl) {
                const repliedMessageLinkRegex = /https:\/\/discord.com\/channels\/[0-9]*\/([0-9]*)\/([0-9]*)/gm;
                const repliedMessageArgs = repliedMessageLinkRegex.exec(repliedMessageUrl);
                if(repliedMessageArgs) {
                    messageUid = await databaseManager.getMessageUid(repliedMessageArgs[1], repliedMessageArgs[2]);
                }
            }  
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
                const url = repliedMessageUrl ? ((replyComponent as ButtonComponent).url ? `https://discord.com/channels/${messagesRecord.guildId}/${messagesRecord.channelId}/${messagesRecord.channelMessageId}` : replyButton.url) : replyButton.url;
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

export const statusUpdate = async (): Promise<void> => {
    let memberObjects: Collection<string, GuildMember> = new Collection();
    const guildIds : string[] = [];
    const chatBroadcasts = await databaseManager.getChatBroadcasts();
    await Promise.allSettled(chatBroadcasts.map(async (broadcast) => {
        const guild = client.guilds.cache.get(broadcast.guildId);
        if(!guild) return;
        if(!guildIds.includes(broadcast.guildId)) guildIds.push(broadcast.guildId);
        memberObjects = memberObjects.concat(guild.members.cache);
    }))

    if (!client.user) {
        logger.wtf(`No client user.`);
        return;
    }

    client.user.setPresence({
        activities: [{
            name: `over ${memberObjects.size} trailblazers in ${guildIds.length} train cars`,
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
            if(!link || !name) {
                logger.warn("Could not get name or link for rebuilding info embed.");
                return;
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

export const createParsedEmoji = (parts: string[]): ParsedEmoji => {
    if(parts.length != 4) {
        throw new Error(`Emoji parts length does not match. Parts: ${parts.join(":")}`);
    }

    return {
        isAnimated: parts[1] === "a",
        name: parts[2],
        id: parts[3]
    };
};

export const replaceEmojis = async (content: string, client: Client): Promise<EmojiReplacementData> => {
    const emoteCapture = /(a?):([^:]+):(\d+)/g;
    const allParsedEmojis: ParsedEmoji[] = [];
    let currentEmojiCapture = emoteCapture.exec(content);
    while (currentEmojiCapture) {
        const currentParsedEmoji = createParsedEmoji(currentEmojiCapture)
        if (!allParsedEmojis.find((data) => data.id === currentParsedEmoji.id)) {
            allParsedEmojis.push(currentParsedEmoji);
        }
        currentEmojiCapture = emoteCapture.exec(content);
    };
    
    const emojis: GuildEmoji[] = [];
    guildEmojiCooldowns.forEach((guildEmojiCooldown, cooldownsIdx) => {
        if (guildEmojiCooldowns.length === 0) return;
        guildEmojiCooldown.cooldowns.forEach((cooldown, cooldownIdx) => {
            if (!guildEmojiCooldown.serverId) return;
            const cooldownInt = parseInt(cooldown);
            if (isNaN(cooldownInt)) {
                logger.warn(`Got a NaN instead of Int: ${cooldown}`);
                guildEmojiCooldown.cooldowns.splice(cooldownIdx, 1);
                return;
            }
            if (Date.now() >= cooldownIdx) {
                guildEmojiCooldown.cooldowns.splice(cooldownIdx, 1);
                return;
            }
        });
        if (guildEmojiCooldown.cooldowns.length <= 1) {
            guildEmojiCooldowns.splice(cooldownsIdx);
            return;
        }
    });
  
    await Promise.allSettled(allParsedEmojis.map(async (emoji) => {
        if (client.emojis.cache.get(emoji.id)) {
            return;
        }
            
        if (guildEmojiCooldowns.length === 0 || guildEmojiCooldowns[guildEmojiCooldowns.length - 1].cooldowns.length >= config.maxEmojiPerServer + 1) {
            if (guildEmojiCooldowns.length >= config.emojiServerIds.length) {
                return;
            }
            guildEmojiCooldowns.push({serverId: config.emojiServerIds[guildEmojiCooldowns.length ? guildEmojiCooldowns.length - 1 : 0], cooldowns: []});
        } 

        const guildId = guildEmojiCooldowns[guildEmojiCooldowns.length - 1].serverId;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return;
        }

        const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.isAnimated ? "gif" : "png"}?v=1`;
        let attachment: Buffer<ArrayBuffer> | undefined;
        const emojiUid = "_Aki" + makeUid(7);
        const emojiCheckRegex = /(.*)(?:_Aki)(.{7})/g;
        const emojiCheck = emojiCheckRegex.exec(emoji.name);
        if(emojiCheck) {
            emoji.name = emoji.name.slice(0, emoji.name.length-11);
            if(!config.cachedEmojiUids.includes(emojiCheck[2])) {
                logger.info(`Someone tried to retrieve from cache with key ${emojiCheck[2]}.`);
                return;
            }
            attachment = await cacheManager.retrieveCache('emoji', emojiCheck[2]);
        }
        if(!attachment) {
            const attachmentBuffer = await axios.get(url, { responseType: 'arraybuffer' });
            attachment = Buffer.from(attachmentBuffer.data, 'utf-8');
            await cacheManager.saveCache('emoji', emojiUid.slice(4), attachment);
            config.cachedEmojiUids.push(emojiUid.slice(4));
        }
        if(emoji.name.length > 32-emojiUid.length) {
            logger.info(`${emoji.name} has been shortened.`);
            emoji.name.slice(0, 32-(emojiUid.length+1));
        }

        let emojiName = "";
        if(emojiCheck) {
            emojiName = emojiCheck[1] + "_Aki" + emojiCheck[2];
        } else {
            emojiName = emoji.name + emojiUid;
        }
        await guild.emojis.create({ attachment, name: emojiName }).then((guildEmoji) => {
            guildEmojiCooldowns[guildEmojiCooldowns.length - 1].cooldowns.push(`${Date.now() + Time.HOUR}`);
            emojis.push(guildEmoji);
        })
    }));
    
    let messageContent = content;
    emojis.forEach(async (emoji) => {
        const regex = new RegExp(`<a?:${emoji.name.slice(0, emoji.name.length-11)}[^:]*:\\d+>`, "g");
        messageContent = messageContent.replaceAll(regex, `${emoji}`);
    })
    return { content: messageContent, emojis: emojis };
}

export const deleteEmojis = async (emojiReplacement: EmojiReplacementData | undefined): Promise<void> => {
    if(!emojiReplacement) return;
    await Promise.allSettled(emojiReplacement.emojis.map(async (emoji) => {
        const guildEmoji = client.emojis.cache.get(emoji.id)
        if (!guildEmoji) return;
        await guildEmoji.guild.emojis.delete(emoji);
    }));
}

export const watermarkSize = async (metadata: sharp.Metadata, serverName: string): Promise<number> => {
    //Do not ask, it works, not gonna fuck around anymore -Birb
    //If ur wondering what this is this calculates the font size of the watermark 'dynamically' with sticker size -Light
    //yoo junghyuk level regression, probably max optimized -Light
    //Gonna replace this soon with smth trust -Birb
    // return 0.0000760966078036 * (metadata.width! * (metadata.height! / (metadata.pages ?? 1))) + 15.71281;

    //Replacement finally done -Birb
    //I can actually explain now whats happening -Birb
    //It calculates the pixels in the hypotenuse and divides it by the amount of letters needed (+2 to make sure it doesnt cut off) -Birb
    //Than it multiplies that with 1.618 which is the avg ratio of pixel width to height -Birb
    return Math.sqrt((metadata.height!/ (metadata.pages ?? 1))**2 + metadata.width!**2)/(serverName.length+2)*1.618 
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

export const experimentalPatchWarning = async () => {
    const broadcasts = await databaseManager.getChatBroadcasts()
        await Promise.allSettled(broadcasts.map(async (broadcast) => {
            const activeWebhook = config.activeWebhooks.find((webhook) => webhook.id === broadcast.webhookId)
            if(!activeWebhook) return;
            await activeWebhook.send({content: "This patch is highly experimental and due to limitations could not be tested fully in beta, if you encounter any problems please let your server's staff or an aeon navigator know.", username: "Akivili"});
        }))
}

export const makeUid = (length: number): string => {
    let result = '';
    const characters = '01234456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}