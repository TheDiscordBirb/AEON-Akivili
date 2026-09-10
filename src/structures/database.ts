import { Logger } from '../logger';
import { DataSource } from 'typeorm';
import { 
    BanshareListRecord, 
    BroadcastRecord, 
    CatCakeRecord, 
    FilteredWordRecord, 
    MessagesRecord, 
    ModmailRecord, 
    UserReactionRecord
} from '../types/database';
import { Messages } from './entities/messages';
import { Broadcasts } from './entities/broadcasts';
import { UserReactions } from './entities/user-reactions';
import { NetworkChatMutedUsers } from './entities/network-chat-muted-users';
import { Modmails } from './entities/modmails';
import { Banshares } from './entities/banshares';
import { CatCakeTypes } from '../types/command';
import { config } from '../const';
import { ErrorNames } from '../types/error-handler';
import { Time } from '../utils/time';
import { FilteredWords } from './entities/filtered-words';
import { Regions } from '../types/command';
import { CatCakes } from './entities/cat-cakes';
import { NetworkStickerStatus } from './entities/network-sticker-status';
import { encryptionManager } from '../utils/data-encryption';

const logger = new Logger('Database');

class DatabaseManager {
    protected _db: DataSource | null = null;
    protected _networkServerStickerStatusCache: NetworkStickerStatus[] = [];
    protected _broadcastCache: BroadcastRecord[] = [];

    constructor() {
        this.connect();
    }

    private connect = async (): Promise<DataSource> => {
        this._db = new DataSource({
            type: 'postgres',
            username: config.databaseUsername,  
            password: config.databasePassword, 
            host: config.databaseHost,  
            port: config.databasePort,  
            database: config.databaseName,  
            logging: false,
            entities: [
                Messages,
                Broadcasts,
                UserReactions,
                NetworkChatMutedUsers,
                Modmails,
                Banshares,
                FilteredWords,
                CatCakes,
                NetworkStickerStatus
            ]
        });
        await this._db.initialize();
        await this._db.synchronize();
        logger.info(`Database connected.`);
        
        // Ensures previously disabled servers stay disabled
        config.disabledStickerNetworkServerIds.map(async (guildId) => {
            const status = await this.getServerStickerStatus(guildId);
            if(status === null) {
                await this.saveServerStickerStatus(guildId, false);
            } else if (status === true) {
                await this.modifyServerStickerStatus(guildId, false);
            }
        });

        return this._db;
    }

    public async disconnect(): Promise<void> {
        const db = await this.db();
        db.destroy();
        this._db = null;
        logger.info('Database disconnected')
    }

    public async db(): Promise<DataSource> {
        if(this._db) return this._db;
        this._db = await this.connect();
        return this._db;
    }
    
    public async saveBroadcast(broadcastRecord: BroadcastRecord): Promise<void> {
        const db = await this.db();
        if (!this._broadcastCache) {
            this._broadcastCache = await this.getBroadcasts();
        }      
        this._broadcastCache.push(broadcastRecord);

        const encryptedData = encryptionManager.databaseValueCryptoOperations(broadcastRecord, 'BroadcastRecord', 'encrypt');
        broadcastRecord = encryptedData as BroadcastRecord;

        await db.createQueryBuilder()
            .insert()
            .into(Broadcasts)
            .values([{
                ...broadcastRecord
            }])
            .execute();
    }

    public async getBroadcasts(): Promise<BroadcastRecord[]> {
        if(this._broadcastCache.length) return this._broadcastCache;
        const db = await this.db();
        const encryptedBroadcastRecords = await db.createQueryBuilder(Broadcasts, "broadcasts")
            .select()
            .getMany();
        const decryptedBroadcastRecords: BroadcastRecord[] = [];
        for(let encryptedBroadcastRecord of encryptedBroadcastRecords) {
            const decryptedData = encryptionManager.databaseValueCryptoOperations(
                encryptedBroadcastRecord, 
                'BroadcastRecord', 
                'decrypt'
            );
            decryptedBroadcastRecords.push(decryptedData as BroadcastRecord);
        }
        console.log(decryptedBroadcastRecords);
        this._broadcastCache = decryptedBroadcastRecords;
        return this._broadcastCache;
    }

    public async getBroadcastByWebhookId(webhookId: string): Promise<BroadcastRecord | undefined> {
        const broadcasts = await this.getBroadcasts();
        return broadcasts.find((broadcast) => broadcast.webhookId === webhookId);
    }

    public async getChatBroadcasts(): Promise<BroadcastRecord[]> {
        const broadcasts = await this.getBroadcasts();
        return broadcasts.filter((broadcast) => !config.nonChatWebhooksTypes.includes(broadcast.channelType));
    }

    public async deleteBroadcastByWebhookId(webhookId: string): Promise<void> {
        const db = await this.db();
        const encryptedWebhookId = encryptionManager.encrypt(webhookId);
        await db.createQueryBuilder(Broadcasts, "broadcasts")
            .delete()
            .where('"webhookId" = :webhookId', { webhookId: encryptedWebhookId })
            .execute();

        const idx = this._broadcastCache.findIndex((cacheElement) => cacheElement.webhookId === webhookId);
        if (idx !== -1) {
            this._broadcastCache.splice(idx, 1);
        }
    }

    public async logMessage(messagesRecord: MessagesRecord): Promise<void> {
        const db = await this.db();
        const encryptedData = encryptionManager.databaseValueCryptoOperations(messagesRecord, 'MessagesRecord', 'encrypt');
        messagesRecord = encryptedData as MessagesRecord;

        await db.createQueryBuilder()
            .insert()
            .into(Messages)
            .values([{
                ...messagesRecord, 
                messageOrigin: !!messagesRecord.messageOrigin
            }])
            .execute();
    }
    
    public async getMessages(channelId: string, channelMessageId: string): Promise<MessagesRecord[]> {
        const db = await this.db();
        const encryptedChannelId = encryptionManager.encrypt(channelId);
        const encryptedChannelMessageId = encryptionManager.encrypt(channelMessageId);

        let message = await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"channelId" = :channelId AND "channelMessageId" = :channelMessageId', 
                { channelId: encryptedChannelId, channelMessageId: encryptedChannelMessageId}
            )
            .getOne();
        if(!message) throw new Error('Could not find message.');

        const encryptedData = encryptionManager.databaseValueCryptoOperations(message, 'MessagesRecord', 'encrypt');
        message = encryptedData as MessagesRecord;

        return await db.createQueryBuilder(Messages, 'messages')
            .select()
            .where('"userId" = :userId AND "uniqueMessageId" = :uniqueMessageId', 
                {userId: message.userId, uniqueMessageId: message.uniqueMessageId}
            )
            .getMany();
    }

    public async deleteMessages(uniqueMessageId: string): Promise<void> {
        const db = await this.db();
        
        await db.createQueryBuilder(Messages, "messages")
            .delete()
            .where('"uniqueMessageId" = :uniqueMessageId', { uniqueMessageId })
            .execute();
    }

    public async getMessageUid(channelId: string, channelMessageId: string): Promise<string> {
        const db = await this.db();
        const encryptedChannelId = encryptionManager.encrypt(channelId);
        const encryptedChannelMessageId = encryptionManager.encrypt(channelMessageId);

        const message = await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"channelId" = :channelId AND "channelMessageId" = :channelMessageId', 
                { channelId: encryptedChannelId, channelMessageId: encryptedChannelMessageId}
            )
            .getOne();
        if(!message) throw new Error(ErrorNames.NO_MESSAGE_IN_DB);
        return message.uniqueMessageId;
    }
    
    public async getMessagesByUid(uniqueMessageId: string): Promise<MessagesRecord[]> {
        const db = await this.db();
        const encryptedUniqueMessageId = encryptionManager.encrypt(uniqueMessageId);

        return await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"uniqueMessageId" = :uniqueMessageId', { uniqueMessageId: encryptedUniqueMessageId })
            .getMany();
    }

    public async getUniqueUserMessageCount(userId: string): Promise<number> {
        const db = await this.db();
        const encryptedUserId = encryptionManager.encrypt(userId);

        return await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"userId" = :userId AND "messageOrigin" = true', { userId: encryptedUserId })
            .getCount();
    }

    public async getUniqueUserMessages(userId: string, amount: number, offset = 0): Promise<MessagesRecord[]> {
        const db = await this.db();
        const count = await this.getUniqueUserMessageCount(userId);
        const encryptedUserId = encryptionManager.encrypt(userId);
        if(count < offset) throw new Error(ErrorNames.NOT_ENOUGH_MESSAGES);
        return await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"userId" = :userId AND "messageOrigin" = true', { userId: encryptedUserId })
            .orderBy('"timestamp" DESC')
            .limit(amount)
            .offset(offset)
            .getMany()
    }

    public async totalMessageLogs(): Promise<number> {
        const db = await this.db();
        return await db.createQueryBuilder(Messages, "messages")
            .select()
            .getCount();
    }

    public async cleanDb(date: number): Promise<void> {
        const db = await this.db();
        await db.createQueryBuilder(Messages, "messages")
            .delete()
            .where('"timestamp" <= :timestamp', { timestamp: date-Time.hours(10)})
            .execute();
        await db.createQueryBuilder(UserReactions, "user_reactions")
            .delete()
            .execute();
        logger.info('Db was cleared.');
    }
    
    public async getUserId(channelId: string, channelMessageId: string): Promise<string> {
        const db = await this.db();
        const encryptedChannelId = encryptionManager.encrypt(channelId);
        const encryptedChannelMessageId = encryptionManager.encrypt(channelMessageId);

        const message = await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"channelId" = :channelId AND "channelMessageId" = :channelMessageId and "messageOrigin" = true',
                { channelId: encryptedChannelId, channelMessageId: encryptedChannelMessageId }
            )
            .getOne()
        if(!message) throw new Error(ErrorNames.NO_MESSAGE_IN_DB);
        return message.userId;
    }
    
    public async toggleUserReaction(userReactionRecord: UserReactionRecord, onlyDelete = false): Promise<void> {
        const db = await this.db();

        const encryptedData = encryptionManager.databaseValueCryptoOperations(userReactionRecord, 'UserReactionRecord', 'encrypt')
        userReactionRecord = encryptedData as UserReactionRecord;
        
        const current = await this.hasUserReactedToMessage(userReactionRecord);
        if(current) {
            if(!onlyDelete) return;
            await db.createQueryBuilder(UserReactions, "user_reactions")
                .delete()
                .where('"userId" = :userId AND "uniqueMessageId" = :uniqueMessageId AND "reactionIdentifier" = :reactionIdentifier',
                    { ...userReactionRecord }
                )
                .execute();
        } else {
            await db.createQueryBuilder(UserReactions, "user_reactions")
                .insert()
                .values([{
                    ...userReactionRecord
                }])
                .execute();
        }
    }

    public async hasUserReactedToMessage(userReactionRecord: UserReactionRecord): Promise<boolean> {
        const db = await this.db();
        return !!await db.createQueryBuilder(UserReactions, "user_reactions")
            .select()
            .where('"userId" = :userId AND "uniqueMessageId" = :uniqueMessageId AND "reactionIdentifier" = :reactionIdentifier',
                { ...userReactionRecord }
            )
            .getCount();
    }

    public async getReactionCountForMessage(uniqueMessageId: string): Promise<number> {
        const db = await this.db();
        const encryptedUniqueMessageId = encryptionManager.encrypt(uniqueMessageId);

        return await db.createQueryBuilder(UserReactions, "user_reactions")
            .select()
            .where('"uniqueMessageId" = :uniqueMessageId', { uniqueMessageId: encryptedUniqueMessageId })
            .getCount();
    }

    public async hasUserBeenMutedOnNetworkChat(userId: string): Promise<boolean> {
        const db = await this.db();
        const encryptedUserId = encryptionManager.encrypt(userId);

        return !!await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
            .select()
            .where('"userId" = :userId', { userId: encryptedUserId })
            .getCount();
    }

    public async whoMutedUser(userId: string): Promise<string> {
        const db = await this.db();
        const encryptedUserId = encryptionManager.encrypt(userId);

        const entry = await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
            .select()
            .where('"userId" = :userId', { userId: encryptedUserId })
            .getOne();
        if(!entry) throw new Error(ErrorNames.NO_MUTE_INFO);
        return entry.staffId;
    }

    public async toggleNetworkChatMute(userId: string, staffId: string): Promise<void> {
        const db = await this.db();
        const encryptedUserId = encryptionManager.encrypt(userId);
        const encrypteStaffId = encryptionManager.encrypt(staffId);

        const current = await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
            .select()
            .where('"userId" = :userId', { userId: encryptedUserId })
            .getCount();
        if(current) {
            await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
                .delete()
                .where('"userId" = :userId', { userId: encryptedUserId })
                .execute();
        } else {
            await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
                .insert()
                .values([{ userId: encryptedUserId, staffId: encrypteStaffId }])
                .execute();
        }
    }

    public async getModmail(channelId: string): Promise<ModmailRecord> {
        const db = await this.db();
        const encryptedChannelId = encryptionManager.encrypt(channelId);

        const result = await db.createQueryBuilder(Modmails, "modmails")
            .select()
            .where('"channelId" = :channelId', { channelId: encryptedChannelId })
            .getOne();
        if(!result) throw new Error(ErrorNames.NO_MODMAIL_IN_DB);
        return result;
    }

    public async getModmailByUserId(userId: string): Promise<ModmailRecord | null> {
        const db = await this.db();
        const encryptedUserId = encryptionManager.encrypt(userId);

        const result = await db.createQueryBuilder(Modmails, "modmails")
            .select()
            .where('"userId" = :userId', { userId: encryptedUserId })
            .getOne();
        return result;
    }
    
    public async createModmail(userId: string, channelId: string): Promise<void> {
        const db = await this.db();
        const encryptedUserId = encryptionManager.encrypt(userId);
        const encryptedChannelId = encryptionManager.encrypt(channelId);

        await db.createQueryBuilder(Modmails, "modmails")
            .insert()
            .values([{ userId: encryptedUserId, channelId: encryptedChannelId, active: true }])
            .execute();
    }

    
    public async closeModmail(channelId: string) {
        const db = await this.db();
        let modmail = await this.getModmail(channelId);

        const encryptedData = encryptionManager.databaseValueCryptoOperations(modmail, 'ModmailRecord', 'encrypt');
        modmail = encryptedData as ModmailRecord;

        await db.createQueryBuilder(Modmails, "modmails")
            .update()
            .where('"userId" = :userId AND "channelId" = :channelId AND "active" = true', 
                { userId: modmail.userId, channelId: modmail.channelId}
            )
            .set({ active: false })
            .execute();
    }

    public async getBanshareList(serverId: string): Promise<BanshareListRecord[]> {
        const db = await this.db();
        const encryptedServerId = encryptionManager.encrypt(serverId);

        return await db.createQueryBuilder(Banshares, "banshares")
            .select()
            .where('"serverId" = :serverId', { serverId: encryptedServerId })
            .getMany();
    }

    public async registerBanshare(banshareListRecord: BanshareListRecord) {
        const db = await this.db();

        const encryptedData = encryptionManager.databaseValueCryptoOperations(banshareListRecord, 'BanshareListRecord', 'encrypt');
        banshareListRecord = encryptedData as BanshareListRecord;

        await db.createQueryBuilder(Banshares, "banshares")
            .insert()
            .values([{ ...banshareListRecord }])
            .execute();
    }

    public async updateBanshareStatus(serverId: string, userId: string, status: string): Promise<void> {
        const db = await this.db();
        const encryptedServerId = encryptionManager.encrypt(serverId);
        const encryptedUserId = encryptionManager.encrypt(userId);
        const encryptedStatus = encryptionManager.encrypt(status);

        const banshare = await db.createQueryBuilder(Banshares, "banshares")
            .select()
            .where('"serverId" = :serverId AND "userId" = :userId', { serverId: encryptedServerId, userId: encryptedUserId })
            .getOne();
        if(!banshare) throw new Error(ErrorNames.NO_MODMAIL_IN_DB);
        await db.createQueryBuilder(Banshares, "banshares")
            .update()
            .where('"serverId" = :serverId AND "userId" = :userId', { serverId: encryptedServerId, userId: encryptedUserId })
            .set({ status: encryptedStatus })
            .execute();
    }

    public async getFilteredWords(): Promise<FilteredWordRecord[]> {
        const db = await this.db();
        const encryptedFilteredWordRecords = await db.createQueryBuilder(FilteredWords, "filtered_words")
            .select()
            .getMany();

        const decryptedFilteredWords: FilteredWordRecord[] = [];
        for(let encryptedFilteredWordRecord of encryptedFilteredWordRecords) {
            const decryptedData = encryptionManager.databaseValueCryptoOperations(
                encryptedFilteredWordRecord, 
                'FilteredWordRecord', 
                'decrypt'
            );
            decryptedFilteredWords.push(decryptedData as FilteredWordRecord);
        }
        return decryptedFilteredWords;
    }


    public async addToFilteredWords(word: string): Promise<void> {
        const db = await this.db();    
        if((await this.getFilteredWords()).includes({ word })) return;
        const encryptedWord = encryptionManager.encrypt(word);
        
        await db.createQueryBuilder(FilteredWords, "filtered_words") 
            .insert()
            .values([{ word: encryptedWord }])
            .execute();
    }

    
    public async insertIntoCatCakes(catCakeRecord: CatCakeRecord):Promise<void> {
        const db = await this.db();

        const encryptedData = encryptionManager.databaseValueCryptoOperations(catCakeRecord, 'CatCakeRecord', 'encrypt');
        catCakeRecord = encryptedData as CatCakeRecord;

        await db.createQueryBuilder(CatCakes, "cat_cakes")
            .insert()
            .values([ catCakeRecord ])
            .execute();
    }

    public async checkForCat(region: Regions, catType: CatCakeTypes): Promise<CatCakeRecord[]> {
        const regionCats = await this.allCatsInRegion(region);
        return regionCats.filter((cat) => cat.catType === catType);
    }

    public async allCatsInRegion(region: Regions): Promise<CatCakeRecord[]> {
        const db = await this.db();
        const encryptedCatCakeRecords = await db.createQueryBuilder(CatCakes, "cat_cakes")
            .select()
            .where('"region" = :region', { region })
            .getMany();

        const decryptedCatCakeRecords: CatCakeRecord[] = [];
        for(let encryptedCatCakeRecord of encryptedCatCakeRecords) {
            const decryptedData = encryptionManager.databaseValueCryptoOperations(
                encryptedCatCakeRecord, 
                'CatCakeRecord', 
                'decrypt'
            );
            decryptedCatCakeRecords.push(decryptedData as CatCakeRecord);
        }
        return decryptedCatCakeRecords;
    }

    public async deleteCatCakeData() {
        const db = await this.db();
        await db.createQueryBuilder(CatCakes, "cat_cakes")
            .delete()
            .execute();
    }

    public async getAllServerStickerStatus() {
        if(this._networkServerStickerStatusCache.length) return this._networkServerStickerStatusCache;
        const db = await this.db();
        const encryptedAllServerStickerStatus =
            await db.createQueryBuilder(NetworkStickerStatus, "network_sticker_status")
                .select()
                .getMany();
        
        const decryptedAllServerStickerStatus: NetworkStickerStatus[] = [];
        for(let encryptedServerStickerStatus of encryptedAllServerStickerStatus) {
            const decryptedData = encryptionManager.databaseValueCryptoOperations(
                encryptedServerStickerStatus,
                'NetworkStickerStatus',
                'decrypt'
            )
            decryptedAllServerStickerStatus.push(decryptedData as NetworkStickerStatus);
        }
        this._networkServerStickerStatusCache = decryptedAllServerStickerStatus;
        return this._networkServerStickerStatusCache;
    }

    public async getServerStickerStatus(serverId: string) {
        const allServerStickerStatus = await this.getAllServerStickerStatus();
        return allServerStickerStatus.find((guild) => guild.guildId === serverId)?.status ?? null;
    }

    public async saveServerStickerStatus(guildId: string, status: boolean, clientId?: string) {
        const statusInDb = await this.getServerStickerStatus(guildId);
        if(statusInDb) throw new Error(ErrorNames.DB_ENTRY_ALREADY_EXISTS);
        const db = await this.db();
        const encryptedGuildId = encryptionManager.encrypt(guildId);

        await db.createQueryBuilder(NetworkStickerStatus, "network_sticker_status")
            .insert()
            .values([{ guildId: encryptedGuildId, status }])
            .execute();
        this._networkServerStickerStatusCache.push({ guildId, status });
        logger.info(`${status ? "Enabled" : "Disabled"} stickers from ${guildId}`, clientId);
    }

    public async modifyServerStickerStatus(guildId: string, status: boolean, clientId?: string) {
        const statusInDb = await this.getServerStickerStatus(guildId);
        if(!statusInDb) throw new Error(ErrorNames.NO_DB_ENTRY);
        if(statusInDb === status) throw new Error(ErrorNames.DID_NOT_MODIFY_DB_DATA);
        const db = await this.db();
        const encryptedGuildId = encryptionManager.encrypt(guildId);

        await db.createQueryBuilder(NetworkStickerStatus, "network_sticker_status")
            .update()
            .where('"guildId" = :guildId', { guildId: encryptedGuildId })
            .set({ guildId: encryptedGuildId, status })
            .execute();
        this._networkServerStickerStatusCache.splice(
            this._networkServerStickerStatusCache.indexOf({ guildId, status: !status }),
            1,
            { guildId, status }
        )
        logger.info(`${status ? "Enabled" : "Disabled"} stickers from ${guildId}`, clientId);
    }
}

export const databaseManager = new DatabaseManager();