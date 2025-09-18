import { GuildMember, Webhook } from "discord.js";
import { BroadcastRecord } from "./database";

export interface InteractionData {
    interactionMember: GuildMember;
    broadcastRecords: BroadcastRecord[];
    channelWebhookBroadcast: BroadcastRecord,
    webhook: Webhook
}
