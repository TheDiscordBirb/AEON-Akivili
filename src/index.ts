require("dotenv").config();
import { client } from "./structures/client";
import { Logger } from "./logger";
import { config } from "./const";
import * as fs from 'fs';
import * as path from 'path';
import { Time } from "./utils";

const logger = new Logger("Index");

config.currentLogFileName = new Date(Date.now()).toISOString().split("T")[0].replaceAll('-', '_');

fs.readdir(path.join(__dirname, '..', '/logs'), (err, files) => {
    const logFiles = files.filter((file) => file.endsWith('.log'));
    if(logFiles.length === 1) return;
    logFiles.forEach((file) => {
        const fileNameSegments = file.replace('.log', '').split('_');
        if(fileNameSegments.length < 3) return;

        try {
            const year = parseInt(fileNameSegments[0]);
            const month = parseInt(fileNameSegments[1]);
            const day = parseInt(fileNameSegments[2]);
            const deletionDeadLine = Time.years(year - 1970) + Time.months(month - 1) + Time.days(day + config.numberOfDaysLogsAreDeletedAfter);
            if(deletionDeadLine < Date.now()) {
                fs.unlinkSync(path.join(__dirname, '..', file));
            }
        } catch {
            logger.warn(`${file} is not formated yy/mm/dd`);
        }
    })
})

import process from 'node:process';
process.on('unhandledRejection', async (reason, promise) => {
    console.log(`Unhandled rejection at: ${promise}, reason: ${reason}`);
})
process.on('uncaughtException', (err) => {
    console.log(`Uncaught exception: ${err}`);
})

client.start();
