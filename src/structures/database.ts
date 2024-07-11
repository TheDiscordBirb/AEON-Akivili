import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { BroadcastRecord, MessagesRecord } from './types';
import { Logger } from "../logger";

const logger = new Logger('Database');

const dbName = 'aeon.db';

class DatabaseManager {
    protected _db: Database | null = null;
    protected _broadcastCache: BroadcastRecord[] | null = null;

    constructor() {
        this.open()
        .catch((error) => {
            console.log('Could not initialize the database.');
        })
    }

    protected open = async (): Promise<Database> => {
        this._db = await open({
            filename: dbName,
            driver: sqlite3.cached.Database,
        });

        await this._db.run(
            `CREATE TABLE IF NOT EXISTS Messages (
                userId TEXT,
                userMessageId TEXT,
                channelId TEXT,
                channelMessageId TEXT,
                guildId TEXT,
                timestamp INT,
                PRIMARY KEY (userMessageId, userId, channelMessageId)
            )`
        )

        await this._db.run(
            `CREATE TABLE IF NOT EXISTS Broadcast (
                channelId TEXT,
                channelType TEXT,
                webhookId TEXT,
                webhookToken TEXT,
                guildId TEXT,
                PRIMARY KEY (webhookId)
            )`
        )

        logger.info('Database initialized.');

        return this._db;
    }

    public async close(): Promise<void> {
        const db = await this.db();
        await db.close();
    }

    public async db(): Promise<Database> {
        if (this._db) return this._db;
        this._db = await this.open();
        return this._db;
    }
    
    public async saveBroadcast(broadcastRecord: BroadcastRecord): Promise<void> {
        const db = await this.db();
        db.run(
            `INSERT OR REPLACE INTO Broadcast (channelId, channelType, webhookId, webhookToken, guildId) VALUES ("${broadcastRecord.channelId}", "${broadcastRecord.channelType}", "${broadcastRecord.webhookId}", "${broadcastRecord.webhookToken}", "${broadcastRecord.guildId}")`,
            (error: Error) => {
                throw new Error(`Could not save into the Broadcast table. Error: ${error.message}`);
            }
        )
        
        if (!this._broadcastCache) {
            this._broadcastCache = await this.getBroadcasts();
        }        
        this._broadcastCache.push(broadcastRecord);
    }

    public async getBroadcasts(): Promise<BroadcastRecord[]> {
        if (this._broadcastCache) return this._broadcastCache;
        const db = await this.db();
        this._broadcastCache = await this.getBroadcastsFromDb();
        return this._broadcastCache;

    }

    public async deleteBroadcastByWebhookId(webhookId: string): Promise<void> {
        const db = await this.db();
        await db.run(`DELETE FROM Broadcast WHERE webhookId="${webhookId}"`);
        if (this._broadcastCache) {
            const idx = this._broadcastCache.findIndex((cacheElement) => cacheElement.webhookId === webhookId);
            if (idx !== -1) {
                this._broadcastCache.splice(idx, 1);
            }
        }
    }

    public async logMessage(messagesRecord: MessagesRecord): Promise<void> {
        const db = await this.db();
        await db.run(
            `INSERT OR REPLACE INTO Messages (userId, userMessageId, channelId, channelMessageId, guildId, timestamp) VALUES ("${messagesRecord.userId}", "${messagesRecord.userMessageId}", "${messagesRecord.channelId}", "${messagesRecord.channelMessageId}", "${messagesRecord.guildId}", ${messagesRecord.timestamp})`,
            (error: Error) => {
                throw new Error(`Could not save record to the Messages table. Error: ${error.message}`);
            }
        );
    }

    public async getMessages(channelId: string, channelMessageId: string, deleteRecords = false): Promise<MessagesRecord[]> {
        const db = await this.db();
        const userMessageRecord = await db.get<MessagesRecord>(`SELECT * FROM Messages WHERE channelId="${channelId}" AND channelMessageId="${channelMessageId}"`);
        if (!userMessageRecord) {
            if (deleteRecords) return [];
            throw new Error(`Could not get user message. ChannelId: ${channelId}, channelMessageId: ${channelMessageId}`);
        }
        const relatedMessageRecords = await db.all<MessagesRecord[]>(`SELECT * FROM Messages WHERE userId="${userMessageRecord.userId}" AND userMessageId="${userMessageRecord.userMessageId}"`);
        if ((relatedMessageRecords.length) && (deleteRecords)) {
            await db.run(`DELETE FROM Messages WHERE userId="${userMessageRecord.userId}" AND userMessageId="${userMessageRecord.userMessageId}"`);
        }
        return relatedMessageRecords;
    }

    public async getMessageUid(channelId: string, channelMessageId: string): Promise<string> {
        const db = await this.db();
        const messageUid = await db.get<{ userMessageId: string }>(`SELECT userMessageId FROM Messages WHERE channelId="${channelId}" AND channelMessageId="${channelMessageId}"`);
        if (!messageUid) {
            throw new Error('Could not get user message.');
        }
        return messageUid.userMessageId;
    }

    public async getMessagesByUid(userMessageId: string): Promise<MessagesRecord[]> {
        const db = await this.db();
        const userMessageRecord = await db.get<MessagesRecord>(`SELECT * FROM Messages WHERE userMessageId="${userMessageId}"`);
        if (!userMessageRecord) {
            throw new Error('Could not get user message.');
        }
        const relatedMessageRecords = await db.all<MessagesRecord[]>(`SELECT * FROM Messages WHERE userMessageId="${userMessageId}"`);
        return relatedMessageRecords;
    }

    public async getUserId(channelId: string, channelMessageId: string): Promise<string> {
        const db = await this.db();
        const userId = await db.get<{ userId: string }>(`SELECT userId FROM Messages WHERE channelId="${channelId}" AND channelMessageId="${channelMessageId}"`);
        if (!userId) {
            throw new Error(`Could not get user id.`);
        }
        return userId.userId;
    }

    private getBroadcastsFromDb = async (): Promise<BroadcastRecord[]> => {
        const db = await this.db();
        const result = await db.all<BroadcastRecord[]>(`SELECT * FROM Broadcast`);
        if (!result) {
            throw new Error('Could not get the contents of the Broadcast table.');
        }
        return result;
    }

}

export const databaseManager = new DatabaseManager();