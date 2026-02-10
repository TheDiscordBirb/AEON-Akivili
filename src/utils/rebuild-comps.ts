import {
    ActionRow,
    MessageActionRowComponent,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonComponent,
    ButtonStyle,
    Message,
    EmbedBuilder,
    APIEmbedField,
} from 'discord.js';
import { UserReactionRecord } from '../types/database';
import { databaseManager } from '../structures/database';
import { ActionRowComponentReconstructionData, CustomId } from '../types/event';
import { Logger } from '../logger';
import { config } from '../const';

const logger = new Logger("rebuildUtils");

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

export const rebuildNetworkInfoEmbeds = async (message: Message, join?: boolean, name?: string, link?: string, remove = false): Promise<EmbedBuilder[]> => {
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
            if(!join) {
                if (link && name) {
                    networkServerStrings.push(`★・[${name}](${link})`);
                }
                if(!link || !name) {
                    logger.warn("Could not get name or link for rebuilding info embed.");
                    return;
                }
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