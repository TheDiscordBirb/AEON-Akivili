import { ApplicationCommandDataResolvable } from "discord.js";

export interface RegisterCommandsOptions {
    guildId?: string;
    commands: ApplicationCommandDataResolvable[];
}

export interface clientInfoData {
    name: string,
    avatarUrl: string | undefined,
}

export interface CachedEmojiName {
    emojiId: string,
    emojiName: string
}