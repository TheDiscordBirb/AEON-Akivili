import { Guild, TextChannel, User } from "discord.js"

export interface BroadcastRecord {
    channelId: string,
    channelType: string,
    guildId: string,
    webhookId: string,
    webhookToken: string,
}

export interface MessagesRecord {
    channelId: string,
    channelMessageId: string,
    guildId: string,
    timestamp: number,
    userId: string,
    userMessageId: string,
    userName: string
}

export interface UserReactionRecord {
    userMessageId: string,
    userId: string,
    reactionName: string
}

export interface BanshareData {
    user: User,
    reason: string,
    proof: string[],
}

export interface JoinData {
    guild: Guild,
    channel: TextChannel,
    type: string
}