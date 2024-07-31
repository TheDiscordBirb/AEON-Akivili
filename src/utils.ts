import { GuildMember, PermissionFlagsBits, ActionRow, MessageActionRowComponent, ActionRowBuilder, ButtonBuilder, ButtonComponent, ButtonStyle } from 'discord.js';
import { UserReactionRecord } from './structures/types';
import { databaseManager } from './structures/database';
import { CustomId } from './types/event';
import { Logger } from './logger';
import { client } from './structures/client';

const logger = new Logger("Utils");

export const hasModerationRights = (guildUser: GuildMember): boolean => {
    return !!(guildUser.roles.cache.find((role) => role.permissions.has(PermissionFlagsBits.BanMembers)));
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
        throw Error(`Could not obtain evironment variable. Id:${id}. Error: ${(error as Error).message}`);
    }
    if (!result) {
        throw Error('Requested environment variable is undefined');
    }
    return result;
}

export const rebuildMessageComponentAfterUserInteraction = async (component: ActionRow<MessageActionRowComponent>[], userReactionRecord: UserReactionRecord): Promise<ActionRowBuilder<ButtonBuilder>[]> => {
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
        if (buttonComponent.customId === userReactionRecord.reactionName) {
            emojiFoundInActionRows = true;
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
            .setCustomId(userReactionRecord.reactionName)
            .setEmoji(userReactionRecord.reactionName)
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

    await databaseManager.toggleUserReaction(userReactionRecord);
    return resultComponent;
}