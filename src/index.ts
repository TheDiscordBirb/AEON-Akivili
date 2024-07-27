require("dotenv").config();
import { client } from "./structures/client";
import { config } from "./const";
import { unlinkSync } from "fs";
import * as path from 'path';
import { Logger } from "./logger";

const logger = new Logger("Index");

if (config.deleteLogsOnStartup) {
    unlinkSync(path.join(__dirname, '..', 'bot.log'));
    logger.info("Previous bot log has been deleted");
}

client.start();
