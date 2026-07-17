import { AttachmentBuilder } from "discord.js";

export interface Files {
    accepted: AttachmentBuilder[],
    rejected: string[]
}
