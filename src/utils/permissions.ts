import { User, GuildTextBasedChannel } from "discord.js";
import { client } from "../structures/client";
import { config } from "../const";
import { databaseManager } from "../structures/database";
import { Time } from "./time";
import { Logger } from "../logger";

const logger = new Logger("permUtils");

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
export const isRep = (user: User): boolean => {
    const aeonGuild = (client.channels.cache.get(config.aeonBanshareChannelId) as GuildTextBasedChannel).guild;
    const aeonMember = aeonGuild.members.cache.get(user.id);
    if (!aeonMember) return false;
    return !!aeonMember.roles.cache.get(config.representativeRoleId);
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