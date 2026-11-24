import { readFileSync, writeFileSync } from "fs";
import { encryptionManager } from "./data-encryption";
import path from "path";
import { Embed, Message } from 'discord.js';

export const saveEmbed = async (message: Message<boolean>): Promise<void> => {
    const enrcyptedData = encryptionManager.encrypt(JSON.stringify(message.embeds));
    writeFileSync(
        path.join(__dirname, "..", "..", "/resources", "infoEmbed.txt"), 
        enrcyptedData,
        { flag: 'w' }
    );
}

export const readEmbedData = (): Promise<Embed[]> => {
    const data = readFileSync(path.join(__dirname, "..", "..", "/resources", "infoEmbed.txt"), "utf-8")
    return JSON.parse(encryptionManager.decrypt(data));

}