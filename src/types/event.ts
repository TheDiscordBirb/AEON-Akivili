import { ActionRowBuilder, ButtonBuilder, GuildEmoji } from "discord.js";

export enum BanShareButtonArg {
    BANSHARE = 'banshare',
    IMPORTANT_BANSHARE = 'importantBanshare',
    REJECT_MAIN = 'rejectMain',
    BAN_FROM_SERVER = 'banFromServer',
    REJECT_SUB = 'rejectSub',
    ACCEPT_REQUEST = 'acceptRequest',
    REJECT_REQUEST = 'rejectRequest'
}

export enum DmMessageButtonArg {
    OPEN_MODMAIL = 'openModmail',
    CLOSE_MODMAIL = 'closeModmail',
    NEW_BANSHARE = 'newBanshare'
}

export enum CrowdControlArg {
    ALLOW = "allow",
    REJECT = "reject"
}

export enum CustomId {
    REPLY = 'Reply',
}

export enum NotificationType {
    BAN = 'ban',
    MODERATOR_BAN = "modBan",
    MESSAGE_EDIT = 'messageEdit',
    MESSAGE_DELETE = 'messageDelete',
    REACTION_DELETE = 'reactionDelete',
    MUTE = 'mute',
    PIN = 'pin',
    CROWD_CONTROL = 'crowdControl',
    SERVER_ADD = 'serverAdd',
    SERVER_REMOVE = 'serverRemove'
}

export interface EmojiReplacementData {
    content: string,
    emojis: GuildEmoji[]
}

export interface ActionRowComponentReconstructionData {
    guildId: string | undefined,
    components: ActionRowBuilder<ButtonBuilder>[]
}

export const guildEmojiCooldowns: string[][] = [];

export enum BanshareStatus {
    PENDING = 'pending',
    REJECTED = 'rejected',
    ENFORCED = 'enforced',
    OVERTURNED = 'overturned'
}