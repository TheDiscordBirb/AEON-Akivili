import { ActionRowBuilder, ButtonBuilder, Guild, GuildEmoji, TextChannel, User } from "discord.js";
import { ServerCooldowns } from "./utils";

export enum JoinRequestButtonArg {
    ACCEPT_REQUEST = 'acceptRequest',
    REJECT_REQUEST = 'rejectRequest'
}
export enum BanShareButtonArg {
    BANSHARE = 'banshare',
    IMPORTANT_BANSHARE = 'importantBanshare',
    REJECT_MAIN = 'rejectMain',
    BAN_FROM_SERVER = 'banFromServer',
    REJECT_SUB = 'rejectSub',
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
    CROWD_CONTROL = 'crowdControl',
    FILTERED_MESSAGE = 'filteredMessage',
    MESSAGE_DELETE = 'messageDelete',
    MESSAGE_EDIT = 'messageEdit',
    MODERATOR_BAN = "modBan",
    MUTE = 'mute',
    PIN = 'pin',
    REACTION_DELETE = 'reactionDelete',
    SERVER_DISCONNECT = 'serverDisconnect',
    SERVER_JOIN = 'serverJoin',
    SERVER_REMOVE = 'serverRemove',
}

export interface EmojiReplacementData {
    content: string,
    emojis: GuildEmoji[]
}

export interface ActionRowComponentReconstructionData {
    guildID: string | undefined,
    components: ActionRowBuilder<ButtonBuilder>[]
}

export const guildEmojiCooldowns: ServerCooldowns[] = [];

export enum BanshareStatus {
    PENDING = 'pending',
    REJECTED = 'rejected',
    ENFORCED = 'enforced',
    OVERTURNED = 'overturned'
}

export interface BanshareRecord {
    user: User | string
    reason: string
    proof: string[]
}

export interface JoinData {
    guild: Guild
    channel: TextChannel
    type: string
    user: User
}
