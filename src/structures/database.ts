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

const logger = new Logger('Database');

class DatabaseManager {
    protected _db: DataSource | null = null;
    protected _broadcastCache: BroadcastRecord[] = [];

    constructor() {
        this.connect();
    }

    private connect = async (): Promise<DataSource> => {
        this._db = new DataSource({
            type: 'postgres',
            username: 'postgres',
            password: 'Akivili',
            host: 'localhost',
            port: 5432,
            database: 'aeon-beta',
            logging: false,
            entities: [
                Messages,
                Broadcasts,
                UserReactions,
                NetworkChatMutedUsers,
                Modmails,
                Banshares,
                FilteredWords,
                CatCakes
            ]
        });
        await this._db.initialize();
        await this._db.synchronize();
        logger.info(`Database connected.`);
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
        await db.createQueryBuilder()
            .insert()
            .into(Broadcasts)
            .values([{
                ...broadcastRecord
            }])
            .execute();

        if (!this._broadcastCache) {
            this._broadcastCache = await this.getBroadcasts();
        }      

        this._broadcastCache.push(broadcastRecord);
    }

    private getBroadcastsFromDb = async (): Promise<BroadcastRecord[]> => {
        const db = await this.db();
        return await db.createQueryBuilder(Broadcasts, "broadcasts")
            .select()
            .getMany();
    }

    public async getBroadcasts(): Promise<BroadcastRecord[]> {
        if(this._broadcastCache) return this._broadcastCache;
        this._broadcastCache = await this.getBroadcastsFromDb();
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
        await db.createQueryBuilder(Broadcasts, "broadcasts")
            .delete()
            .where('"webhookId" = :webhookId', { webhookId })
            .execute();

        const idx = this._broadcastCache.findIndex((cacheElement) => cacheElement.webhookId === webhookId);
        if (idx !== -1) {
            this._broadcastCache.splice(idx, 1);
        }
    }

    public async logMessage(messagesRecord: MessagesRecord): Promise<void> {
        const db = await this.db();
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
        const message = await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"channelId" = :channelId AND "channelMessageId" = :channelMessageId', { channelId, channelMessageId})
            .getOne();
        if(!message) throw new Error('Could not find message.');
        return await db.createQueryBuilder(Messages, 'messages')
            .select()
            .where('"userId" = :userId AND "uniqueMessageId" = :uniqueMessageId', {userId: message.userId, uniqueMessageId: message.uniqueMessageId})
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
        const message = await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"channelId" = :channelId AND "channelMessageId" = :channelMessageId', { channelId, channelMessageId})
            .getOne();
        if(!message) throw new Error(ErrorNames.NO_MESSAGE_IN_DB);
        return message.uniqueMessageId;
    }
    
    public async getMessagesByUid(uniqueMessageId: string): Promise<MessagesRecord[]> {
        const db = await this.db();
        return await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"uniqueMessageId" = :uniqueMessageId', { uniqueMessageId })
            .getMany();
    }

    public async getUniqueUserMessageCount(userId: string): Promise<number> {
        const db = await this.db();
        return await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"userId" = :userId AND "messageOrigin" = true', { userId })
            .getCount();
    }

    public async getUniqueUserMessages(userId: string, amount: number, offset = 0): Promise<MessagesRecord[]> {
        const db = await this.db();
        const count = await this.getUniqueUserMessageCount(userId);
        if(count < offset) throw new Error(ErrorNames.NOT_ENOUGH_MESSAGES);
        return await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"userId" = :userId AND "messageOrigin" = true')
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
        const message = await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"channelId" = :channelId AND "channelMessageId" = :channelMessageId and "messageOrigin" = true',
                { channelId, channelMessageId }
            )
            .getOne()
        if(!message) throw new Error(ErrorNames.NO_MESSAGE_IN_DB);
        return message.userId;
    }
    
    public async toggleUserReaction(userReactionRecord: UserReactionRecord, onlyDelete = false): Promise<void> {
        const db = await this.db();
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
        return await db.createQueryBuilder(UserReactions, "user_reactions")
            .select()
            .where('"uniqueMessageId" = :uniqueMessageId', { uniqueMessageId })
            .getCount();
    }

    public async hasUserBeenMutedOnNetworkChat(userId: string): Promise<boolean> {
        const db = await this.db();
        return !!await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
            .select()
            .where('"userId" = :userId', { userId })
            .getCount();
    }

    public async whoMutedUser(userId: string): Promise<string> {
        const db = await this.db();
        const entry = await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
            .select()
            .where('"userId" = :userId', { userId })
            .getOne();
        if(!entry) throw new Error(ErrorNames.NO_MUTE_INFO);
        return entry.staffId;
    }

    public async toggleNetworkChatMute(userId: string, staffId: string): Promise<void> {
        const db = await this.db();
        const current = await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
            .select()
            .where('"userId" = :userId', { userId })
            .getCount();
        if(current) {
            await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
                .delete()
                .where('"userId" = :userId', { userId })
                .execute();
        } else {
            await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
                .insert()
                .values([{ userId, staffId }])
                .execute();
        }
    }

    public async getModmail(channelId: string): Promise<ModmailRecord> {
        const db = await this.db();
        const result = await db.createQueryBuilder(Modmails, "modmails")
            .select()
            .where('"channelId" = :channelId', { channelId })
            .getOne();
        if(!result) throw new Error(ErrorNames.NO_MODMAIL_IN_DB);
        return result;
    }

    public async getModmailByUserId(userId: string): Promise<ModmailRecord> {
        const db = await this.db();
        const result = await db.createQueryBuilder(Modmails, "modmails")
            .select()
            .where('"userId" = :userId', { userId })
            .getOne();
        if(!result) throw new Error(ErrorNames.NO_MODMAIL_IN_DB);
        return result;
    }
    
    public async createModmail(userId: string, channelId: string): Promise<void> {
        const db = await this.db();
        await db.createQueryBuilder(Modmails, "modmails")
            .insert()
            .values([{ userId, channelId, active: true }])
            .execute();
    }

    
    public async closeModmail(channelId: string) {
        const db = await this.db();
        const modmail = await this.getModmail(channelId);
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
        return await db.createQueryBuilder(Banshares, "banshares")
            .select()
            .where('"serverId" = :serverId', { serverId })
            .getMany();
    }

    public async registerBanshare(data: BanshareListRecord) {
        const db = await this.db();
        await db.createQueryBuilder(Banshares, "banshares")
            .insert()
            .values([{ ...data }])
            .execute();
    }

    public async updateBanshareStatus(serverId: string, userId: string, status: string): Promise<void> {
        const db = await this.db();
        const banshare = await db.createQueryBuilder(Banshares, "banshares")
            .select()
            .where('"serverId" = :serverId AND "userId" = :userId', { serverId, userId })
            .getOne();
        if(!banshare) throw new Error(ErrorNames.NO_MODMAIL_IN_DB);
        await db.createQueryBuilder(Banshares, "banshares")
            .update()
            .where('"serverId" = :serverId AND "userId" = :userId', { serverId, userId })
            .set({ status })
            .execute();
    }

    public async getFilteredWords(): Promise<FilteredWordRecord[]> {
        const db = await this.db();
        return await db.createQueryBuilder(FilteredWords, "filtered_words")
            .select()
            .getMany();
    }


    public async addToFilteredWords(word: string): Promise<void> {
        const db = await this.db();    
        if((await this.getFilteredWords()).includes({ word })) return;
        await db.createQueryBuilder(FilteredWords, "filtered_words") 
            .insert()
            .values([{ word }])
            .execute();
    }

    
    public async insertIntoCatCakes(uid: string, region: Regions, catType: CatCakeTypes):Promise<void> {
        const db = await this.db();
        await db.createQueryBuilder(CatCakes, "cat_cakes")
            .insert()
            .values([{ uid, region, catType }])
            .execute();
    }

    public async checkForCat(region: Regions, catType: CatCakeTypes): Promise<CatCakeRecord[]> {
        const regionCats = await this.allCatsInRegion(region);
        return regionCats.filter((cat) => cat.catType === catType);
    }

    public async allCatsInRegion(region: Regions): Promise<CatCakeRecord[]> {
        const db = await this.db();
        return await db.createQueryBuilder(CatCakes, "cat_cakes")
            .select()
            .where('"region" = :region', { region })
            .getMany();
    }

    
    public async deleteCatCakeData() {
        const db = await this.db();
        await db.createQueryBuilder(CatCakes, "cat_cakes")
            .delete()
            .execute();
    }
}

export const databaseManager = new DatabaseManager();