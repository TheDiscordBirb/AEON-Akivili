import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { 
    BanshareListRecord,
    BroadcastRecord,
    CatCakeRecord,
    FilteredWordRecord,
    MessagesRecord,
    ModmailRecord,
    UserReactionRecord
} from '../types/database';
import { Logger } from "../logger";
import { config } from '../const';
import * as fs from "fs";
import path from 'path';
import { Time } from '../utils/time';
import { messageFilter } from '../functions/message-filter';
import { CatCakeTypes, Regions } from '../types/command';

const logger = new Logger('Database');

const dbName = 'aeon.db';

class DatabaseManager {
    protected _db: Database | null = null;
    protected _broadcastCache: BroadcastRecord[] | null = null;

    constructor() {
        this.open()
        .catch((error) => {
            logger.warn('Could not initialize the database.', error as Error);
        })
        this.setUpDb()
        .catch((error) => {
            logger.warn("Could not set up db correctly.", error as Error)
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
                uniqueMessageId TEXT,
                username TEXT,
                channelId TEXT,
                channelMessageId TEXT,
                guildId TEXT,
                timestamp INT,
                messageOrigin INT,
                PRIMARY KEY (uniqueMessageId, userId, channelMessageId)
            )`
        )

        await this._db.run(
            `CREATE TABLE IF NOT EXISTS Broadcast (
                channelId TEXT,
                channelType TEXT,
                webhookId TEXT,
                guildId TEXT,
                importantBanshareRoleId TEXT,
                autoBanLevel INT,
                serviceClientId TEXT,
                PRIMARY KEY (webhookId)
            )`
        )

        await this._db.run(
            `CREATE TABLE IF NOT EXISTS UserReaction (
                uniqueMessageId TEXT,
                userId TEXT,
                reactionIdentifier TEXT,
                PRIMARY KEY (uniqueMessageId, userId, reactionIdentifier)
            )`
        )

        await this._db.run(
            `CREATE TABLE IF NOT EXISTS NetworkChatMutedUser (
                userId TEXT,
                staffId TEXT,
                PRIMARY KEY (userId)
            )`
        )

        await this._db.run(
            `CREATE TABLE IF NOT EXISTS NetworkProfiles (
                userId TEXT,
                name TEXT,
                avatar BLOB,
                PRIMARY KEY (userId)
            )`
        )

        await this._db.run(
            `CREATE TABLE IF NOT EXISTS Modmails (
                userId TEXT,
                channelId TEXT,
                active INT,
                PRIMARY KEY (channelId)
            )`
        )

        await this._db.run(
            `CREATE TABLE IF NOT EXISTS Banshares (
                serverId TEXT,
                status TEXT,
                userId TEXT,
                reason TEXT,
                proof TEXT,
                timestamp INT,
                PRIMARY KEY (serverId, userId, reason, proof, timestamp)
            )`
        )

        await this._db.run(
            `CREATE TABLE IF NOT EXISTS FilteredWordRecord (
                word TEXT,
                PRIMARY KEY (word)
            )`
        )

        await this._db.run(
            `CREATE TABLE IF NOT EXISTS CatCakes (
                uid TEXT,
                region TEXT,
                catType TEXT,
                PRIMARY KEY (uid, catType)
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
    
    private async setUpDb(): Promise<void> {
        const messagesInDb = await this.totalMessageLogs();
        logger.info(`There ${messagesInDb >= 100000 ? "were" : "are"} ${messagesInDb} messages in Db.`);
        if(messagesInDb >= 100000) {
            await this.cleanDb(Date.now());
        }
        await messageFilter.addToFilterArray(await this.getFilteredWordRecord());
    }
    
    public async saveBroadcast(broadcastRecord: BroadcastRecord): Promise<void> {
        const db = await this.db();
        db.run(
            `INSERT OR REPLACE INTO Broadcast (channelId, channelType, webhookId, guildId, importantBanshareRoleId, autoBanLevel, serviceClientId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                broadcastRecord.channelId,
                broadcastRecord.channelType,
                broadcastRecord.webhookId,
                broadcastRecord.guildId,
                broadcastRecord.importantBanshareRoleId,
                broadcastRecord.autoBanLevel,
                broadcastRecord.serviceClientId
            ],
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
        try {
            this._broadcastCache = await this.getBroadcastsFromDb();
        } catch (error) {
            logger.error(`Could not get broadcast records. Error: `, error as Error);
            return [];
        }
        return this._broadcastCache;
        
    }

    public async getBroadcastByWebhookId(webhookId: string): Promise<BroadcastRecord | undefined> {
        const db = await this.db();
        const result = await db.get<BroadcastRecord>(`SELECT * FROM Broadcast WHERE webhookId=?`, [webhookId]);
        return result;
    }

    public async getChatBroadcasts(): Promise<BroadcastRecord[]> {
        if(this._broadcastCache) {
            return this._broadcastCache.filter((broadcast) => !config.nonChatWebhooksTypes.includes(broadcast.channelType));
        }
        try {
            this._broadcastCache = await this.getBroadcastsFromDb();
        } catch (error) {
            logger.error(`Could not get broadcast records. Error: `, error as Error);
            return [];
        }
        return this._broadcastCache.filter((broadcast) => !config.nonChatWebhooksTypes.includes(broadcast.channelType));
    }

    private getBroadcastsFromDb = async (): Promise<BroadcastRecord[]> => {
        const db = await this.db();
        const result = await db.all<BroadcastRecord[]>(`SELECT * FROM Broadcast`);
        if (!result) {
            throw new Error('Could not get the contents of the Broadcast table.');
        }
        return result;
    }
    
    public async deleteBroadcastByWebhookId(webhookId: string): Promise<void> {
        const db = await this.db();
        await db.run(`DELETE FROM Broadcast WHERE webhookId=?`, [webhookId]);
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
            `INSERT OR REPLACE INTO Messages (userId, uniqueMessageId, username, channelId, channelMessageId, guildId, timestamp, messageOrigin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [messagesRecord.userId, messagesRecord.uniqueMessageId, messagesRecord.username, messagesRecord.channelId, messagesRecord.channelMessageId, messagesRecord.guildId, messagesRecord.timestamp, messagesRecord.messageOrigin],
            (error: Error) => {
                throw new Error(`Could not save record to the Messages table. Error: ${error.message}`);
            }
        );
    }

    public async getMessages(channelId: string, channelMessageId: string, deleteRecords = false): Promise<MessagesRecord[]> {
        const db = await this.db();
        const userMessageRecord = await db.get<MessagesRecord>(`SELECT * FROM Messages WHERE channelId=? AND channelMessageId=?`, [channelId, channelMessageId]);
        if (!userMessageRecord) {
            if (deleteRecords) return [];
            throw new Error(`Could not get user message. ChannelId: ${channelId}, channelMessageId: ${channelMessageId}`);
        }
        const relatedMessageRecords = await db.all<MessagesRecord[]>(`SELECT * FROM Messages WHERE userId=? AND uniqueMessageId=?`, [userMessageRecord.userId, userMessageRecord.uniqueMessageId]);
        if ((relatedMessageRecords.length) && (deleteRecords)) {
            await db.run(`DELETE FROM Messages WHERE userId=? AND uniqueMessageId=?`, [userMessageRecord.userId, userMessageRecord.uniqueMessageId]);
        }
        return relatedMessageRecords;
    }

    public async getMessageUid(channelId: string, channelMessageId: string): Promise<string> {
        const db = await this.db();
        const messageUid = await db.get<{ uniqueMessageId: string }>(`SELECT uniqueMessageId FROM Messages WHERE channelId=? AND channelMessageId=?`, [channelId, channelMessageId]);
        if (!messageUid) {
            throw new Error('Could not get user message.');
        }
        return messageUid.uniqueMessageId;
    }

    public async getMessagesByUid(uniqueMessageId: string): Promise<MessagesRecord[]> {
        const db = await this.db();
        const relatedMessageRecords = await db.all<MessagesRecord[]>(`SELECT * FROM Messages WHERE uniqueMessageId=?`, uniqueMessageId);
        if (!relatedMessageRecords?.length) {
            throw new Error('Could not get user message.');
        }
        return relatedMessageRecords;
    }

    public async getUniqueUserMessages(userId: string, amount: number, offset = 0): Promise<MessagesRecord[]> {
        const db = await this.db();
        const allUniqueUserMessageRecords = await db.all<MessagesRecord[]>(`SELECT * FROM Messages WHERE userId=? AND messageOrigin=1`, [userId]);
        if(allUniqueUserMessageRecords.length < offset) {
            throw new Error('User does not have enough messages.');
        }
        const uniqueUserMessageRecords = await db.all<MessagesRecord[]>(`SELECT * FROM Messages WHERE userId=? AND messageOrigin=1 ORDER BY timestamp DESC LIMIT ? OFFSET ?`, [userId, amount, offset]);
        if (!uniqueUserMessageRecords?.length) {
            throw new Error('Could not get user message.');
        }
        return uniqueUserMessageRecords;
    }

    public async totalMessageLogs(): Promise<number> {
        const db = await this.db();
        const amount = await db.get<{count: number}>(`SELECT COUNT(*) as 'count' FROM Messages`);
        if(!amount) {
            throw new Error("Could not get total amount of messages.");
        }
        return amount.count;
    }

    private async backUpDb(date: number): Promise<void> {
        const backUpName = `aeon_backup_${date}.db`
        try {
            fs.copyFileSync(path.join(".", dbName), path.join(".", backUpName));
        } catch(e) {
            throw new Error((e as Error).message);
        }
        logger.info(`Db has been backed up into ${backUpName}`);
    }

    public async cleanDb(date: number): Promise<void> {
        const db = await this.db();
        await this.backUpDb(date);
        try {
            await db.run(`DELETE FROM Messages WHERE timestamp<=?`, [date-Time.hours(10)]);
            await db.run(`DELETE FROM UserReaction`);
        } catch(e) {
            throw new Error((e as Error).message);
        }
        logger.info("Db was cleared");
    }

    public async getUserId(channelId: string, channelMessageId: string): Promise<string> {
        const db = await this.db();
        const userId = await db.get<{ userId: string }>(`SELECT userId FROM Messages WHERE channelId=? AND channelMessageId=?`, [channelId, channelMessageId]);
        if (!userId) {
            throw new Error(`Could not get user id.`);
        }
        return userId.userId;
    }


    public async toggleUserReaction(userReactionRecord: UserReactionRecord): Promise<void> {
        const db = await this.db();
        const result = await db.get<UserReactionRecord>(`SELECT * FROM UserReaction WHERE userId = ? AND uniqueMessageId=? and reactionIdentifier=?`, [ userReactionRecord.userId, userReactionRecord.uniqueMessageId, userReactionRecord.reactionIdentifier])
        if (!result) {
            await db.run(`INSERT OR REPLACE INTO UserReaction (userId, uniqueMessageId, reactionIdentifier) VALUES (?, ?, ?)`, [ userReactionRecord.userId, userReactionRecord.uniqueMessageId, userReactionRecord.reactionIdentifier])
        } else {
            await db.run(`DELETE FROM UserReaction WHERE userId = ? AND uniqueMessageId=? and reactionIdentifier=?`, [userReactionRecord.userId, userReactionRecord.uniqueMessageId, userReactionRecord.reactionIdentifier]);
        }
    }

    public async deleteReaction(userReactionRecord: UserReactionRecord): Promise<void> {
        const db = await this.db();
        const result = await db.get<UserReactionRecord>(`SELECT * FROM UserReaction WHERE uniqueMessageId=? and reactionIdentifier=?`, [userReactionRecord.uniqueMessageId, userReactionRecord.reactionIdentifier])
        if (!result) {
            throw new Error(`Could not find reactions to delete.`);
        } else {
            await db.run(`DELETE FROM UserReaction WHERE uniqueMessageId=? and reactionIdentifier=?`, [userReactionRecord.uniqueMessageId,userReactionRecord.reactionIdentifier]);
        }
    }

    public async hasUserReactedToMessage(userReactionRecord: UserReactionRecord): Promise<boolean> {
        const db = await this.db();
        const result = await db.get<UserReactionRecord>(`SELECT * FROM UserReaction WHERE userId = "${userReactionRecord.userId}" AND uniqueMessageId="${userReactionRecord.uniqueMessageId}" and reactionIdentifier="${userReactionRecord.reactionIdentifier}"`)
        return (!!result);
    }

    public async getReactionCountForMessage(uniqueMessageId: string): Promise<number> {
        const db = await this.db();
        const result = await db.all<UserReactionRecord[]>(`SELECT * FROM UserReaction WHERE userId = ?`, [uniqueMessageId])
        return result.length;
    }

    public async hasUserBeenMutedOnNetworkChat(userId: string): Promise<boolean> {
        const db = await this.db();
        const result = await db.get<{ userId: string }>(`SELECT * FROM NetworkChatMutedUser WHERE userId = ?`, [userId])
        return (!!result);
    }

    public async whoMutedUser(userId: string): Promise<string | undefined> {
        const db = await this.db();
        return await db.get(`SELECT staffId FROM NetworkChatMutedUser WHERE userId = ?`, [userId]);
    }

    public async toggleNetworkChatMute(userId: string, staffId: string): Promise<void> {
        const db = await this.db();
        const result = await db.get<{ userId: string }>(`SELECT * FROM NetworkChatMutedUser WHERE userId = ?`, [userId]);
         if (!result) {
            await db.run(`INSERT OR REPLACE INTO NetworkChatMutedUser (userId, staffId) VALUES (?, ?)`, [userId,staffId]);
        } else {
            await db.run(`DELETE FROM NetworkChatMutedUser WHERE userId = ?`, [userId]);
        }
    }

    public async getModmail(channelId: string): Promise<ModmailRecord> {
        const db = await this.db();
        const result = await db.get<ModmailRecord>(`SELECT * FROM Modmails WHERE channelId = ?`, [channelId]);
        if(!result) {
            throw new Error("Could not find modmail.");
        }
        return result;
    }

    public async getModmailByUserId(userId: string): Promise<ModmailRecord> {
        const db = await this.db();
        const result = await db.get<ModmailRecord>(`SELECT * FROM Modmails WHERE userId = ? AND active = ?`, [userId, 1]);
        if(!result) {
            throw new Error("Could not find modmail.");
        }
        return result;
    }

    public async createModmail(userId: string, channelId: string): Promise<void> {
        const db = await this.db();
        await db.run(`INSERT OR REPLACE INTO Modmails (userId, channelId, active) VALUES (?, ?, ?)`, [userId, channelId, 1]);
    }

    public async closeModmail(channelId: string) {
        const db = await this.db();
        const modmail = await this.getModmail(channelId);
        await db.run(`INSERT OR REPLACE INTO Modmails (userId, channelId, active) VALUES (?, ?, ?)`, [modmail.userId, channelId, 0]);
    }

    public async getBanshareList(serverId: string): Promise<BanshareListRecord[]> {
        const db = await this.db();
        const result = await db.all<BanshareListRecord[]>(`SELECT * FROM Banshares WHERE serverId=?`, [serverId]);
        if(!result) {
            throw new Error(`Could not get banshares for server ${serverId}.`);
        }
        return result;
    }

    public async registerBanshare(data: BanshareListRecord) {
        const db = await this.db();
        await db.run(`INSERT OR REPLACE INTO Banshares (serverId, status, userId, reason, proof, timestamp) VALUES (?, ?, ?, ?, ?, ?)`, [data.serverId, data.status, data.userId, data.reason, data.proof, data.timestamp]);
    }

    public async updateBanshareStatus(serverId: string, userId: string, status: string) {
        const db = await this.db();
        const banshare = await db.get<BanshareListRecord>(`SELECT * FROM Banshares WHERE serverId=? AND userId=?`, [serverId, userId]);
        if(!banshare) {
            throw new Error(`Could not get banshare for ${userId} in ${serverId}`);
        }
        await db.run(`INSERT OR REPLACE INTO Banshares (serverId, status, userId, reason, proof, timestamp) VALUES (?, ?, ?, ?, ?, ?)`, [banshare.serverId, status, banshare.userId, banshare.reason, banshare.proof, banshare.timestamp]);
    }

    public async getFilteredWordRecord(): Promise<FilteredWordRecord[]> {
        const db = await this.db();
        const result = await db.all<FilteredWordRecord[]>(`SELECT word FROM FilteredWordRecord`);
        return result;
    }

    public async addToFilteredWordRecord(word: string) {
        const db = await this.db();
        const currentWords = await this.getFilteredWordRecord();
        if(!currentWords.includes({word})) {
            await db.run(`INSERT INTO FilteredWordRecord (word) VALUES (?)`, [word]);
        }
    }

    public async insertIntoCatCakes(uid: string, region: Regions, catType: CatCakeTypes) {
        const db = await this.db();
        await db.run(`INSERT OR REPLACE INTO CatCakes (uid, region, catType) VALUES (?, ?, ?)`, [uid, region, catType],
            (error: Error) => {
                throw new Error(`Could not insert cat cake into CatCakes Error: ${error.message}`);
            }
        );
    }

    public async checkForCat(region: Regions, catType: CatCakeTypes) {
        const db = await this.db();
        const result = await db.all<CatCakeRecord[]>(`SELECT * FROM CatCakes WHERE region=? AND catType=?`, [region, catType],
            (error: Error) => {
                throw new Error("Got an error checking for cats");
            }
        )
        if(!result.length) {
            return [];
        }
        return result;
    }

    public async allCatsInRegion(region: Regions) {
        const db = await this.db();
        const result = await db.all<CatCakeRecord[]>(`SELECT * FROM CatCakes WHERE region=?`, [region],
            (error: Error) => {
                throw new Error("Got an error during getting all cats from region");
            }
        )
        if(!result.length) {
            return [];
        }
        return result;
    }

    public async deleteCatCakeRecord() {
        const db = await this.db();
        await db.run(`DELETE FROM CatCakes`,
            (error: Error) => {
                throw new Error(`Could not delete cat cakes.`);
            }
        );
    }
}

export const _ = new DatabaseManager();
