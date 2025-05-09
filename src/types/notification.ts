import { Guild, Message, User } from "discord.js"

export interface NotificationData {
    executingUser: User,
    notificationType: string,
    time: number,
    guild: Guild,
    channelType?: string
    targetUser?: User,
    message?: Message,
    oldContent?: string,
    newContent?: string,
    deletedReacionIdentifier?: string,
    images?: string[]
    banshareReason?: string,
    deletedByMod?: boolean,
}