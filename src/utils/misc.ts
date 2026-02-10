import {
    ActivityType,
    GuildMember,
    Collection,
} from 'discord.js';
import { databaseManager } from '../structures/database';
import { Logger } from '../logger';
import { client } from '../structures/client';
import { config } from '../const';
import { clientInfoData } from '../types/client';
import sharp from 'sharp';
import { sleep } from './time';
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