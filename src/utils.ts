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
    Embed,
    EmbedBuilder,
    APIEmbedField,
    User,
    GuildTextBasedChannel
} from 'discord.js';
import { UserReactionRecord } from './types/database';
import { databaseManager } from './structures/database';
import { CustomId } from './types/event';
import { Logger } from './logger';
import { client } from './structures/client';
import process from 'node:process';

const logger = new Logger("Utils");
const maxEmbedColumnValueLength = 1024;
const aeonBanshareChannelId = '1261386307477831720';
const navigatorRoleId = '1114294050737115240';

export const hasModerationRights = (guildUser: GuildMember): boolean => {
    return !!(guildUser.roles.cache.find((role) => role.permissions.has(PermissionFlagsBits.BanMembers)));
}

export const isNavigator = (user: User): boolean => {
    const aeonGuild = (client.channels.cache.get(aeonBanshareChannelId) as GuildTextBasedChannel).guild;
    const aeonMember = aeonGuild.members.cache.get(user.id);
    return !!aeonMember?.roles.cache.get(navigatorRoleId);
}
export const doesUserOwnMessage = (userIdInDb: string | undefined, userId: string): boolean => {
    return userIdInDb === userId;
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

export const getEnvVar = <T>(id: string): T => {
    let result;
    try {
        result = process.env[id] as T;
    } catch (error) {
        throw Error(`Could not obtain environment variable. Id:${id}. Error: ${(error as Error).message}`);
    }
    if (!result) {
        throw Error('Requested environment variable is undefined');
    }
    return result;
}

export const rebuildMessageComponentAfterUserInteraction = async (component: ActionRow<MessageActionRowComponent>[], userReactionRecord: UserReactionRecord, deleteAll = false): Promise<ActionRowBuilder<ButtonBuilder>[]> => {
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
    
    let resultComponent: ActionRowBuilder<ButtonBuilder>[] = [];

    if (hasReplyRow) {
        const replyButtons: ButtonBuilder[] = [];
        component[0].components.forEach((replyComponent) => {
            const replyButton = replyComponent as ButtonComponent;
            const url = replyButton.url;
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

    if (deleteAll) {
        try {
            await databaseManager.deleteReaction(userReactionRecord);
        } catch (error) {
            logger.error(`Got error while deleting reactions.`, (error as Error));
        }
    } else {
        await databaseManager.toggleUserReaction(userReactionRecord);
    }
    return resultComponent;
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
                if (newAccColumnValue.length <= maxEmbedColumnValueLength) {
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