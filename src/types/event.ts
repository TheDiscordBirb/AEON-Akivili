import { Emoji, GuildEmoji } from "discord.js";

export enum BanShareButtonArg {
    BANSHARE = 'banshare',
    IMPORTANT_BANSHARE = 'importantBanshare',
    REJECT_MAIN = 'rejectMain',
    BAN_FROM_SERVER = 'banFromServer',
    REJECT_SUB = 'rejectSub',
    ACCEPT_REQUEST = 'acceptRequest',
    REJECT_REQUEST = 'rejectRequest'
}

export enum CustomId {
    REPLY = 'Reply',
}

export enum NotificationType {
    BAN = 'ban',
    MESSAGE_EDIT = 'messageEdit',
    MESSAGE_DELETE = 'messageDelete',
    REACTION_DELETE = 'reactionDelete',
    MUTE = 'mute'
}

export interface EmojiReplacementData {
    content: string,
    emojis: GuildEmoji[]
}

export const guildEmojiCooldowns: string[][] = [];