import { ExtendedClientTypes } from "./client"
import { CatCakeTypes, Regions } from "./command"

export interface CachedBanshare {
    banshareUid: string,
    serverId: string,
    userId: string
}

export interface CachedModmail {
    modmailUid: string,
    channelId: string,
    userId: string,
    active: boolean
}

export interface CachedStickerStatus {
    stickerUid: string,
    guildId: string,
    status: boolean
}

export interface CachedMute {
    muteUid: string,
    userId: string,
    staffId: string
}

export interface CachedReaction {
    reactionUid: string,
    messageUid: string,
    userId: string,
    reactionIdentifier: string
}

export interface CachedMessage {
    messageUid: string,
    userId: string,
    messageIds: string[]
}

export interface CachedClient {
    clientUid: string,
    clientId: string,
    type: ExtendedClientTypes
}

export type DatabaseTypes = BroadcastRecord |
    NetworkStickerStatus |
    MessagesRecord |
    ModmailRecord |
    UserReactionRecord |
    BanshareListRecord |
    FilteredWordRecord |
    CatCakeRecord

export interface BroadcastRecord {
    broadcastUid: string,
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
    channelId: string
    discordMessageId: string,
    guildId: string,
    timestamp: number,
    userId: string,
    messageUid: string,
    username: string,
    messageOrigin: boolean
}

export interface ModmailRecord {
    modmailUid: string,
    userId: string,
    channelId: string,
    active: boolean
}

export interface UserReactionRecord {
    messageUid: string,
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