import {
    ChatInputApplicationCommandData,
    CommandInteraction,
    CommandInteractionOptionResolver,
    GuildMember,
    PermissionResolvable
} from "discord.js";
import { ExtendedClient } from "../structures/client";

export interface ExtendedInteraction extends CommandInteraction {
    member: GuildMember;
}

export interface RunOptions {
    client: ExtendedClient;
    interaction: ExtendedInteraction;
    args: CommandInteractionOptionResolver;
}

type RunFunction = (options: RunOptions) => any;

export type CommandType = {
    userPermissions?: PermissionResolvable[];
    run: RunFunction;
} & ChatInputApplicationCommandData;

export enum BanShareOption {
    YES = 'yes',
    NO = 'no',
}

export enum NetworkJoinOptions {
    BANSHARE = 'Banshare',
    STAFF = 'Staff',
    GENERAL = 'General',
    INFO = 'Info'
}

export enum AutoBanLevelOptions {
    NONE = '0',
    IMPORTANT = '1',
    ALL = '2'
}

export enum ButtonTypes {
    BACK = 'back',
    FORWARD = 'forward',
    SERVER_SELECTOR = 'serverSelector',
    WEBHOOK = 'webhook',
    MENU_BACK = 'menuBack',
    REMOVE_SERVER = 'removeServer'
}