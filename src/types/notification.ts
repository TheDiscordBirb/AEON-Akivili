import { Collection, Guild, GuildMember, Message, NonThreadGuildBasedChannel, Snowflake, User } from "discord.js"

export interface NotificationData {
    executingUser: User,
    notificationType: string,
    time: number,
    guild: Guild,
    privateNotification?: boolean,
    channelType?: string
    targetUser?: User,
    message?: Message,
    oldContent?: string,
    newContent?: string,
    deletedReacionIdentifier?: string,
    images?: string[]
    banshareReason?: string,
    deletedByMod?: boolean,
    guildData?: GuildData,
    filteredWords?: string[]
}

interface GuildData {
    guildMembers: Collection<Snowflake, GuildMember>,
    guildChannels: Collection<Snowflake, NonThreadGuildBasedChannel | null>
}