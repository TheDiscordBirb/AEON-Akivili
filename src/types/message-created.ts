import { GuildMember } from "discord.js";
import { BroadcastRecord } from "./database";

export interface InteractionData {
    interactionMember: GuildMember;
    broadcastRecords: BroadcastRecord[];
    channelWebhook: BroadcastRecord
}
