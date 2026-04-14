import { GuildMember, Webhook } from "discord.js";
import { BroadcastRecord } from "./database";
import { AttachmentBuilder } from "discord.js";

export interface InteractionData {
    interactionMember: GuildMember;
    broadcastRecords: BroadcastRecord[];
    channelWebhookBroadcast: BroadcastRecord,
    webhook: Webhook
}

export interface Files {
    accepted: AttachmentBuilder[],
    rejected: string[]
}
