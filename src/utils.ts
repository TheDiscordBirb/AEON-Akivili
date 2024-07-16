import { GuildMember, PermissionFlagsBits } from 'discord.js';
import { Logger } from './logger';

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