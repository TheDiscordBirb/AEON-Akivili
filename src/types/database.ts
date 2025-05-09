import { Guild, TextChannel, User } from "discord.js"

export interface BroadcastRecord {
    webhookId: string,
    channelType: string,
    importantBanshareRoleId: string | null,
    autoBanLevel: number
}

export interface MessagesRecord {
    channelId: string,
    channelMessageId: string,
    guildId: string,
    timestamp: number,
    userId: string,
    userMessageId: string,
    userName: string,
    messageOrigin: number
}

export interface ModmailRecord {
    userId: string,
    channelId: string,
    active: number
}

export interface UserReactionRecord {
    userMessageId: string,
    userId: string,
    reactionIdentifier: string
}

export interface BanshareData {
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

export interface NetworkProfileData {
    userId: string,
    name: string,
    avatarUrl: string
}

export interface BanshareListData {
    serverId: string,
    status: string,
    userId: string,
    reason: string,
    proof: string,
    timestamp: number
}