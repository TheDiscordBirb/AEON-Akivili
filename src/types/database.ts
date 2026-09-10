import { CatCakeTypes, Regions } from "./command"

export type DatabaseTypes = BroadcastRecord |
    NetworkStickerStatus |
    MessagesRecord |
    ModmailRecord |
    UserReactionRecord |
    BanshareListRecord |
    FilteredWordRecord |
    CatCakeRecord

export interface BroadcastRecord {
    channelId: string,
    channelType: string,
    guildId: string,
    webhookId: string,
    importantBanshareRoleId: string,
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