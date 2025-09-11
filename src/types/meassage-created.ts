import { ActionRow, ActionRowBuilder, AttachmentBuilder, BaseGuildTextChannel, ButtonBuilder, Embed, GuildMember, MessageActionRowComponent, MessageType, Webhook, WebhookClient, WebhookType } from "discord.js";
import { BroadcastRecord } from "./database";

export interface InteractionData {
    interactionMember: GuildMember;
    broadcastRecords: BroadcastRecord[];
    channelWebhook: BroadcastRecord
}
