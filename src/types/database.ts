import { Guild, TextChannel, User } from "discord.js"
import { CatCakeTypes, Regions } from "./command"

export interface BroadcastRecord {
    channelId: string,
    channelType: string,
    guildId: string,
    webhookId: string,
    importantBanshareRoleId: string | null,
    autoBanLevel: number,
    serviceClientId: string
}

export interface NetworkStickerStatus {
    guildId: string,
    status: boolean
}

export interface MessagesRecord {
    channelId: string,
    channelMessageId: string,
    guildId: string,
    timestamp: number,
    userId: string,
    uniqueMessageId: string,
    username: string,
    messageOrigin: boolean
}

export interface ModmailRecord {
    userId: string,
    channelId: string,
    active: boolean
}

export interface UserReactionRecord {
    uniqueMessageId: string,
    userId: string,
    reactionIdentifier: string
}

export interface BanshareRecord {
    user: User | string,
    reason: string,
    proof: string[],
}

export interface JoinData {
    guild: Guild,
    channel: TextChannel,
    type: string,
    user: User
}

export interface BanshareListRecord {
    serverId: string,
    status: string,
    userId: string,
    reason: string,
    proof: string,
    timestamp: number
}

export interface FilteredWordRecord {
    word: string
}

export interface CatCakeRecord {
    uid: string,
    region: Regions,
    catType: CatCakeTypes
}