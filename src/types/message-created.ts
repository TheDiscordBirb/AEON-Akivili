import { GuildMember, Webhook, WebhookType } from "discord.js";
import { BroadcastRecord } from "./database";

export interface InteractionData {
    interactionMember: GuildMember;
    webhooks: Webhook<WebhookType>[];
    broadcast: BroadcastRecord
}
