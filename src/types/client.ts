import { ApplicationCommandDataResolvable } from "discord.js";
import { ExtendedClient } from "../structures/client";

export interface RegisterCommandsOptions {
    guildId?: string;
    commands: ApplicationCommandDataResolvable[];
}

export enum ExtendedClientTypes {
    LIVE = "live",
    BETA = "beta",
    ALPHA = "alpha"
}