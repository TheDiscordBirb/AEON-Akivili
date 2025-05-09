import { ApplicationCommandDataResolvable } from "discord.js";

export interface RegisterCommandsOptions {
    guildId?: string;
    commands: ApplicationCommandDataResolvable[];
}

export interface clientInfoData {
    name: string,
    avatarUrl: string | undefined,
}

export enum ClearanceLevel {
    USER = 0, //D-Class
    MANAGE_MESSAGES = 1,
    MODERATOR = 2,
    REPRESENTATIVE = 3,
    NAVIGATOR = 4,
    CONDUCTOR = 5, //O5-4
    DEV = 6 //Administrator
}