import { Client, ApplicationEmoji } from 'discord.js';
import { EmojiReplacementData } from '../types/event';
import { Logger } from '../logger';
import axios from 'axios';
import { config } from '../const';
import { cacheManager } from '../structures/memcache';
import { ParsedEmoji } from '../types/utils';
import { makeUid } from './misc';
import { clients } from '../structures/client';
import { ExtendedClientTypes } from '../types/client';
import { ErrorNames } from '../types/error-handler'

const logger = new Logger("emojiUtils");

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
    
    const emojis: ApplicationEmoji[] = [];
  
    await Promise.allSettled(allParsedEmojis.map(async (emoji) => {
        if(!client.application) throw new Error(ErrorNames.NO_CLIENT_APPLICATION);
        if (client.emojis.cache.get(emoji.id)) {
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
        await client.application.emojis.create({ attachment, name: emojiName }).then((guildEmoji) => {
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
    const client = clients.find((c) => c.clientType === (config.debugMode ? ExtendedClientTypes.ALPHA : ExtendedClientTypes.LIVE));
    if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);
    if(!emojiReplacement) return;
    await Promise.allSettled(emojiReplacement.emojis.map(async (emoji) => {
        if(!client.application) throw new Error(ErrorNames.NO_CLIENT_APPLICATION);
        const applicationEmoji = client.application.emojis.cache.get(emoji.id)
        if (!applicationEmoji) throw new Error(ErrorNames.NO_CLIENT_EMOJI);
        await client.application.emojis.delete(emoji);
    }));
}