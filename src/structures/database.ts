import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { 
    BanshareListData,
    BroadcastRecord,
    MessagesRecord,
    ModmailRecord,
    NetworkProfileData,
    UserReactionRecord
} from '../types/database';
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
                userName TEXT,
                channelId TEXT,
                channelMessageId TEXT,
                guildId TEXT,
                timestamp INT,
                messageOrigin INT,
                PRIMARY KEY (userMessageId, userId, channelMessageId)
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
                PRIMARY KEY (webhookId)
            )`
        )

        await this._db.run(
            `CREATE TABLE IF NOT EXISTS UserReaction (
                userMessageId TEXT,
                userId TEXT,
                reactionIdentifier TEXT,
                PRIMARY KEY (userMessageId, userId, reactionIdentifier)
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
            `INSERT OR REPLACE INTO Broadcast (channelId, channelType, webhookId, guildId, importantBanshareRoleId, autoBanLevel) VALUES (?, ?, ?, ?, ?, ?)`,
            [broadcastRecord.channelId, broadcastRecord.channelType, broadcastRecord.webhookId, broadcastRecord.guildId, broadcastRecord.importantBanshareRoleId, broadcastRecord.autoBanLevel],
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
            `INSERT OR REPLACE INTO Messages (userId, userMessageId, userName, channelId, channelMessageId, guildId, timestamp, messageOrigin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [messagesRecord.userId, messagesRecord.userMessageId, messagesRecord.userName, messagesRecord.channelId, messagesRecord.channelMessageId, messagesRecord.guildId, messagesRecord.timestamp, messagesRecord.messageOrigin],
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
        const relatedMessageRecords = await db.all<MessagesRecord[]>(`SELECT * FROM Messages WHERE userId=? AND userMessageId=?`, [userMessageRecord.userId, userMessageRecord.userMessageId]);
        if ((relatedMessageRecords.length) && (deleteRecords)) {
            await db.run(`DELETE FROM Messages WHERE userId=? AND userMessageId=?`, [userMessageRecord.userId, userMessageRecord.userMessageId]);
        }
        return relatedMessageRecords;
    }

    public async getMessageUid(channelId: string, channelMessageId: string): Promise<string> {
        const db = await this.db();
        const messageUid = await db.get<{ userMessageId: string }>(`SELECT userMessageId FROM Messages WHERE channelId=? AND channelMessageId=?`, [channelId, channelMessageId]);
        if (!messageUid) {
            throw new Error('Could not get user message.');
        }
        return messageUid.userMessageId;
    }

    public async getMessagesByUid(userMessageId: string): Promise<MessagesRecord[]> {
        const db = await this.db();
        const relatedMessageRecords = await db.all<MessagesRecord[]>(`SELECT * FROM Messages WHERE userMessageId=?`, userMessageId);
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
        const result = await db.get<UserReactionRecord>(`SELECT * FROM UserReaction WHERE userId = ? AND userMessageId=? and reactionIdentifier=?`, [ userReactionRecord.userId, userReactionRecord.userMessageId, userReactionRecord.reactionIdentifier])
        if (!result) {
            await db.run(`INSERT OR REPLACE INTO UserReaction (userId, userMessageId, reactionIdentifier) VALUES (?, ?, ?)`, [ userReactionRecord.userId, userReactionRecord.userMessageId, userReactionRecord.reactionIdentifier])
        } else {
            await db.run(`DELETE FROM UserReaction WHERE userId = ? AND userMessageId=? and reactionIdentifier=?`, [userReactionRecord.userId, userReactionRecord.userMessageId, userReactionRecord.reactionIdentifier]);
        }
    }

    public async deleteReaction(userReactionRecord: UserReactionRecord): Promise<void> {
        const db = await this.db();
        const result = await db.get<UserReactionRecord>(`SELECT * FROM UserReaction WHERE userMessageId=? and reactionIdentifier=?`, [userReactionRecord.userMessageId, userReactionRecord.reactionIdentifier])
        if (!result) {
            throw new Error(`Could not find reactions to delete.`);
        } else {
            await db.run(`DELETE FROM UserReaction WHERE userMessageId=? and reactionIdentifier=?`, [userReactionRecord.userMessageId,userReactionRecord.reactionIdentifier]);
        }
    }

    public async hasUserReactedToMessage(userReactionRecord: UserReactionRecord): Promise<boolean> {
        const db = await this.db();
        const result = await db.get<UserReactionRecord>(`SELECT * FROM UserReaction WHERE userId = "${userReactionRecord.userId}" AND userMessageId="${userReactionRecord.userMessageId}" and reactionIdentifier="${userReactionRecord.reactionIdentifier}"`)
        return (!!result);
    }

    public async getReactionCountForMessage(userMessageId: string): Promise<number> {
        const db = await this.db();
        const result = await db.all<UserReactionRecord[]>(`SELECT * FROM UserReaction WHERE userId = ?`, [userMessageId])
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

    public async getCustomProfile(userId: string): Promise<NetworkProfileData | undefined> {
        const db = await this.db();
        const result = await db.get<NetworkProfileData>(`SELECT * FROM NetworkProfiles WHERE userId = ?`, [userId]);
        return result;
    }

    public async updateCustomProfile(networkProfileData: NetworkProfileData, deleteProfile = false): Promise<void> {
        const db = await this.db();
        if (deleteProfile) {
            await db.run(`DELETE FROM NetworkProfiles WHERE userId = ?`, [networkProfileData.userId]);
        } else {
            await db.run(`INSERT OR REPLACE INTO NetworkProfiles (userId, name, avatarUrl) VALUES (?, ?, ?)`, [networkProfileData.userId,networkProfileData.name,networkProfileData.avatarUrl]);
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

    public async getBanshareList(serverId: string): Promise<BanshareListData[]> {
        const db = await this.db();
        const result = await db.all<BanshareListData[]>(`SELECT * FROM Banshares WHERE serverId=?`, [serverId]);
        if(!result) {
            throw new Error(`Could not get banshares for server ${serverId}.`);
        }
        return result;
    }

    public async registerBanshare(data: BanshareListData) {
        const db = await this.db();
        await db.run(`INSERT OR REPLACE INTO Banshares (serverId, status, userId, reason, proof, timestamp) VALUES (?, ?, ?, ?, ?, ?)`, [data.serverId, data.status, data.userId, data.reason, data.proof, data.timestamp]);
    }

    public async updateBanshareStatus(serverId: string, userId: string, status: string) {
        const db = await this.db();
        const banshare = await db.get<BanshareListData>(`SELECT * FROM Banshares WHERE serverId=? AND userId=?`, [serverId, userId]);
        if(!banshare) {
            throw new Error(`Could not get banshare for ${userId} in ${serverId}`);
        }
        await db.run(`INSERT OR REPLACE INTO Banshares (serverId, status, userId, reason, proof, timestamp) VALUES (?, ?, ?, ?, ?, ?)`, [banshare.serverId, status, banshare.userId, banshare.reason, banshare.proof, banshare.timestamp]);
    }
}

export const databaseManager = new DatabaseManager();
