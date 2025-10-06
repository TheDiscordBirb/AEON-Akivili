import { writeFileSync } from 'fs';
import * as path from 'path';
import { config } from './const';

export enum LogLevel {
    WTF = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
}

export const LogLevelName: Record<LogLevel, string> = {
    [LogLevel.WTF]  : '[WTF  ]',
    [LogLevel.ERROR]: '[ERROR]',
    [LogLevel.WARN] : '[WARN ]',
    [LogLevel.INFO] : '[INFO ]',
    [LogLevel.DEBUG]: '[DEBUG]',
}

export class Logger {
    private logFileBuffer: string[] = [];

    constructor(
        protected moduleName: string,
        protected fileName?: string,
        protected logFileBatchSize = 1,
        protected defaultLogLevel = 3 + (config.debugMode ? 1 : 0),
    ) {
        this.moduleName = this.moduleName.padEnd(20,' ');
    }

    public wtf(message: string) {
        this.log(`${LogLevelName[LogLevel.WTF]} ${this.moduleName} : ${this.now()} - ${message}`, LogLevel.WTF);
    }

    public error(message: string, error: Error) {
        this.log(`${LogLevelName[LogLevel.ERROR]} ${this.moduleName} : ${this.now()} - ${message}\nError: ${error}`, LogLevel.ERROR);
    }

    public warn(message: string, error?: Error) {
        let log = `${LogLevelName[LogLevel.WARN]} ${this.moduleName} : ${this.now()} - ${message}`;
        if (error) {
            log = `${log}\nError: ${error}`;
        }
        this.log(log, LogLevel.WARN);
    }

    public info(message: string) {
        const log = `${LogLevelName[LogLevel.INFO]} ${this.moduleName} : ${this.now()} - ${message}`;
        this.log(log, LogLevel.INFO);
    }

    public debug(message: string) {
        let log = `${LogLevelName[LogLevel.DEBUG]} ${this.moduleName} : ${this.now()} - ${message}`;
        this.log(log, LogLevel.DEBUG);
    }

    private log = (log: string, level: LogLevel): void => {
        if (level <= this.defaultLogLevel) {
            console.log(log);
            this.logFileBuffer.push(`${log}\n`);
            if (this.logFileBuffer.length >= this.logFileBatchSize) {
                this.logBufferIntoFile();
                this.logFileBuffer = [];
            }
        }
    }

    private logBufferIntoFile = (): void => {
        try {
            writeFileSync(path.join(__dirname, '..', '/logs', `${config.currentLogFileName}.log`), this.logFileBuffer.join('\n'), { flag:'a' });
        } catch (error) {
            console.log('Could not write into the log file. Error: ', (error as Error).message);
        }
    }

    private now = (): string =>
        `${new Date().toISOString().
            replace(/T/, ' ').
            replace(/\..+/, '')}`
}