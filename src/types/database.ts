import { CatCakeTypes, Regions } from "./command"

export interface DbBase {
    type: DatabaseTypesEnum
}

export enum DatabaseTypesEnum {
    BROADCAST_RECORD = "BroadcastRecord",
    NETWORK_STICKER_STATUS = "NetworkStickerStatus",
    MESSAGES_RECORD = "MessagesRecord",
    MODMAIL_RECORD = "ModmailRecord",
    USER_REACTION_RECORD = "UserReactionRecord",
    BANSHARE_LIST_RECORD = "BanshareListRecord",
    FILTERED_WORD_RECORD = "FilteredWordRecord",
    CAT_CAKE_RECORD = "CatCakeRecord"
}

export type DatabaseTypes = BroadcastRecord |
    NetworkStickerStatus |
    MessagesRecord |
    ModmailRecord |
    UserReactionRecord |
    BanshareListRecord |
    FilteredWordRecord |
    CatCakeRecord

export interface BroadcastRecord extends DbBase {
    type: DatabaseTypesEnum.BROADCAST_RECORD,
    channelId: string,
    channelType: string,
    guildId: string,
    webhookId: string,
    importantBanshareRoleId: string,
    autoBanLevel: number,
    serviceClientId: string
}

export interface NetworkStickerStatus extends DbBase {
    type: DatabaseTypesEnum.NETWORK_STICKER_STATUS,
    guildId: string,
    status: boolean
}

export interface MessagesRecord extends DbBase {
    type: DatabaseTypesEnum.MESSAGES_RECORD,
    channelId: string,
    channelMessageId: string,
    guildId: string,
    timestamp: number,
    userId: string,
    uniqueMessageId: string,
    username: string,
    messageOrigin: boolean
}

export interface ModmailRecord extends DbBase {
    type: DatabaseTypesEnum.MODMAIL_RECORD,
    userId: string,
    channelId: string,
    active: boolean
}

export interface UserReactionRecord extends DbBase {
    type: DatabaseTypesEnum.USER_REACTION_RECORD,
    uniqueMessageId: string,
    userId: string,
    reactionIdentifier: string
}

export interface BanshareListRecord extends DbBase {
    type: DatabaseTypesEnum.BANSHARE_LIST_RECORD,
    serverId: string,
    status: string,
    userId: string,
    reason: string,
    proof: string,
    timestamp: number
}

export interface FilteredWordRecord extends DbBase {
    type: DatabaseTypesEnum.FILTERED_WORD_RECORD,
    word: string
}

export interface CatCakeRecord extends DbBase {
    type: DatabaseTypesEnum.CAT_CAKE_RECORD,
    uid: string,
    region: Regions,
    catType: CatCakeTypes
}