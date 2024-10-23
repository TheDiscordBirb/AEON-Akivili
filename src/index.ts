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
/*
import process from 'node:process';
process.on('unhandledRejection', async (reason, promise) => {
    console.log(`Unhandled rejection at: ${promise}, reason: ${reason}`);
})
process.on('uncaughtException', (err) => {
    console.log(`Uncaught exception: ${err}`);
})
*/
client.start();
