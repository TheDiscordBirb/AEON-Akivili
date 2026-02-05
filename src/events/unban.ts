import { Event } from "../structures/event";
import { Logger } from "../logger";
import { databaseManager } from "../structures/database";
import { BanshareStatus } from "../types/event";
import { config } from "../const";

const logger = new Logger(`UnbanEvent`);

export default new Event("guildBanRemove", async (guildBan) => {
    if(config.botStarting) return;
    try {
        await databaseManager.updateBanshareStatus(guildBan.guild.id, guildBan.user.id, BanshareStatus.OVERTURNED);
    } catch(error) {
        logger.error(`${guildBan.user.username}`, (error as Error));
    }
});