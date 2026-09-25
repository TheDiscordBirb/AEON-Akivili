import { Logger } from '../logger';
import { DataSource } from 'typeorm';
import { 
    BanshareListRecord, 
    BroadcastRecord, 
    CachedClient, 
    CachedMessage, 
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
import { Clients } from './entities/clients';
import { ExtendedClientTypes } from '../types/client';
import { ulid } from 'ulid';

const logger = new Logger('Database');

class DatabaseManager {
    protected _db: DataSource | null = null;
    protected _networkServerStickerStatusCache: NetworkStickerStatus[] = [];
    protected _broadcastCache: BroadcastRecord[] = [];
    protected _messageCache: CachedMessage[] = [];
    protected _clientCache: CachedClient[] = [];

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
            logging: true,
            schema: 'AkiDb',
            extensions: ["pgcrypto"],
            entities: [
                Messages,
                Broadcasts,
                UserReactions,
                NetworkChatMutedUsers,
                Modmails,
                Banshares,
                FilteredWords,
                CatCakes,
                NetworkStickerStatus,
                Clients
            ]
        });
        await this._db.initialize();
        await this._db.synchronize();
        logger.info(`Database connected.`);
        
        // Ensures previously disabled servers stay disabled
        await Promise.allSettled(config.disabledStickerNetworkServerIds.map(async (guildId) => {
            const status = await this.getServerStickerStatus(guildId);
            if(status === null) {
                await this.saveServerStickerStatus(guildId, false);
            } else if (status === true) {
                await this.modifyServerStickerStatus(guildId, false);
            }
        }));

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
        this._broadcastCache = await db.createQueryBuilder(Broadcasts, "broadcasts")
            .select()
            .getMany();

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
        
        const cachedMessage = this._messageCache.find((cachedMessage) => cachedMessage.messageUid === messagesRecord.messageUid);
        if(cachedMessage) {
            if(!cachedMessage.messageIds.includes(messagesRecord.discordMessageId)) {
                cachedMessage.messageIds.push(messagesRecord.discordMessageId);
            }
        } else {
            if(this._messageCache.length >= config.numberOfMessagesToLoad) this._broadcastCache.pop();
            this._messageCache.unshift({ messageUid: messagesRecord.messageUid, userId: messagesRecord.userId, messageIds: [messagesRecord.discordMessageId]});
        }
    }

    public async loadMessages(): Promise<void> {
        const db = await this.db();
        const messages = await db.createQueryBuilder(Messages, 'messages')
            .select()
            .limit(config.numberOfMessagesToLoad)
            .getMany();
        await Promise.allSettled(messages.map((message) => {
            const cachedMessage = this._messageCache.find((cachedMessage) => cachedMessage.messageUid === message.messageUid);
            if(cachedMessage) {
                if(!cachedMessage.messageIds.includes(message.discordMessageId)) {
                    cachedMessage.messageIds.push(message.discordMessageId);
                }
            } else {
                this._messageCache.push({ messageUid: message.messageUid, userId: message.userId, messageIds: [message.discordMessageId]});
            }
        }));
        await this.cleanDb();
    }
    
    public async getMessages(discordMessageId: string): Promise<MessagesRecord[]> {
        const messageUid = this.getMessageUid(discordMessageId);
        return this.getMessagesByUid(messageUid);
    }

    public async deleteMessages(messageUid: string): Promise<void> {
        const db = await this.db();
        await db.createQueryBuilder(Messages, "messages")
            .delete()
            .where('"messageUid" = :messageUid', { messageUid })
            .execute();
    }

    public getMessageUid(discordMessageId: string): string {
        const cachedMessage = this._messageCache.find((cachedMessage) => cachedMessage.messageIds.includes(discordMessageId));
        if(!cachedMessage) throw new Error(ErrorNames.NO_MESSAGE);
        return cachedMessage.messageUid;
    }
    
    public async getMessagesByUid(messageUid: string): Promise<MessagesRecord[]> {
        const db = await this.db();
        return await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"messageUid" = :messageUid', { messageUid })
            .getMany();
    }

    public async getUniqueUserMessageCountInCache(userId: string): Promise<number> {
        return this._messageCache.filter((message) => message.userId === userId).length;
    }

    public async deleteAllUserMessages(userId: string): Promise<void> {
        const db = await this.db();
        const userCachedMessages = this._messageCache.filter((message) => message.userId === userId)
        for(const userCachedMessage of userCachedMessages) {
            await db.createQueryBuilder(Messages, "messages")
                .delete()
                .where('"messageUid" = :messageUid', { messageUid: userCachedMessage.messageUid })
                .execute();
            await db.createQueryBuilder(UserReactions, "user_reactions")
                .delete()
                .where('"messageUid" = :messageUid', { messageUid: userCachedMessage.messageUid })
                .execute();
        }
    }

    public async getLastMessageForUser(userId: string): Promise<MessagesRecord> {
        const db = await this.db();
        const cachedMessage = this._messageCache.find((message) => message.userId === userId);
        if(!cachedMessage) throw new Error(ErrorNames.NO_MESSAGE_IN_CACHE);
        const dbMessage = await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"messageUid" = :messageUid AND "messageOrigin" = true', { messageUid: cachedMessage.messageUid})
            .getOne();
        if(!dbMessage) throw new Error(ErrorNames.NO_MESSAGE_IN_DB);
        return dbMessage;
    }

    public async totalMessageLogs(): Promise<number> {
        const db = await this.db();
        return await db.createQueryBuilder(Messages, "messages")
            .select()
            .getCount();
    }

    public async cleanDb(): Promise<void> {
        const db = await this.db();
        const cachedUids = this._messageCache.reduce<string[]>((acc, item) => {
            if(!acc.includes(item.messageUid)) {
                acc.push(item.messageUid)
            }
            return acc;
        }, []);
        await db.createQueryBuilder(Messages, "messages")
            .delete()
            .where('"messageUid" NOT IN (:...messageUids)', { messageUids: cachedUids })
            .execute();
        await db.createQueryBuilder(UserReactions, "user_reactions")
            .delete()
            .where('"messageUid" NOT IN (:...messageUids)', { messageUids: cachedUids })
            .execute();
        logger.info('Db was cleared.');
    }
    
    public async getUserId(discordMessageId: string): Promise<string> {
        const db = await this.db();
        const messageUid = this.getMessageUid(discordMessageId);
        const message = await db.createQueryBuilder(Messages, "messages")
            .select()
            .where('"messageUid" = :messageUid AND "messageOrigin" = true',
                { messageUid }
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
                .where('"userId" = :userId AND "queMessageId" = :messageUid AND "reactionIdentifier" = :reactionIdentifier',
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
            .where('"userId" = :userId AND "messageUid" = :messageUid AND "reactionIdentifier" = :reactionIdentifier',
                { ...userReactionRecord }
            )
            .getCount();
    }

    public async getReactionCountForMessage(messageUid: string): Promise<number> {
        const db = await this.db();
        return await db.createQueryBuilder(UserReactions, "user_reactions")
            .select()
            .where('"messageUid" = :messageUid', { messageUid })
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

    public async getModmailByUserId(userId: string): Promise<ModmailRecord | null> {
        const db = await this.db();

        return await db.createQueryBuilder(Modmails, "modmails")
            .select()
            .where('"userId" = :userId', { userId })
            .getOne();
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
        let modmail = await this.getModmail(channelId);
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

    public async registerBanshare(banshareListRecord: BanshareListRecord) {
        const db = await this.db();
        await db.createQueryBuilder(Banshares, "banshares")
            .insert()
            .values([{ ...banshareListRecord }])
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

    
    public async insertIntoCatCakes(catCakeRecord: CatCakeRecord):Promise<void> {
        const db = await this.db();
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
        return await db.createQueryBuilder(CatCakes, "cat_cakes")
            .select()
            .where('"region" = :region', { region })
            .getMany();
    }

    public async deleteCatCakeData(): Promise<void> {
        const db = await this.db();
        await db.createQueryBuilder(CatCakes, "cat_cakes")
            .delete()
            .execute();
    }

    public async getAllServerStickerStatus(): Promise<NetworkStickerStatus[]> {
        if(this._networkServerStickerStatusCache.length) return this._networkServerStickerStatusCache;
        const db = await this.db();
        return await db.createQueryBuilder(NetworkStickerStatus, "network_sticker_status")
            .select()
            .getMany();
    }

    public async getServerStickerStatus(serverId: string): Promise<boolean> {
        const allServerStickerStatus = await this.getAllServerStickerStatus();
        const serverStickerStatus = allServerStickerStatus.find((guild) => guild.guildId === serverId)?.status;
        if(serverStickerStatus === undefined) throw new Error(ErrorNames.NO_DB_ENTRY);
        return serverStickerStatus;
    }

    public async saveServerStickerStatus(guildId: string, status: boolean, clientId?: string): Promise<void> {
        const statusInDb = await this.getServerStickerStatus(guildId);
        if(statusInDb) throw new Error(ErrorNames.DB_ENTRY_ALREADY_EXISTS);
        const db = await this.db();

        await db.createQueryBuilder(NetworkStickerStatus, "network_sticker_status")
            .insert()
            .values([{ guildId, status }])
            .execute();
        this._networkServerStickerStatusCache.push({ guildId, status });
        logger.info(`${status ? "Enabled" : "Disabled"} stickers from ${guildId}`, clientId);
    }

    public async modifyServerStickerStatus(guildId: string, status: boolean, clientId?: string): Promise<void> {
        const statusInDb = await this.getServerStickerStatus(guildId);
        if(!statusInDb) throw new Error(ErrorNames.NO_DB_ENTRY);
        if(statusInDb === status) throw new Error(ErrorNames.DID_NOT_MODIFY_DB_DATA);
        const db = await this.db();

        await db.createQueryBuilder(NetworkStickerStatus, "network_sticker_status")
            .update()
            .where('"guildId" = :guildId', { guildId })
            .set({ guildId, status })
            .execute();
        this._networkServerStickerStatusCache.splice(
            this._networkServerStickerStatusCache.indexOf({ guildId, status: !status }),
            1,
            { guildId, status }
        )
        logger.info(`${status ? "Enabled" : "Disabled"} stickers from ${guildId}`, clientId);
    }

    public async loadClientTypes(): Promise<CachedClient[]> {
        const db = await this.db();
        if(this._clientCache.length) return this._clientCache;
        const clients = await db.createQueryBuilder(Clients, "clients")
            .select()
            .getMany();
        this._clientCache = clients;
        return this._clientCache;
    }

    public async saveClient(clientId: string) {
        const db = await this.db();
        const uid = ulid();
        await db.createQueryBuilder(Clients, "clients")
            .insert()
            .into(Clients)
            .values([{
                uid,
                clientId,
                type: ExtendedClientTypes.ALPHA
            }])
            .execute();
        this._clientCache.push({ uid, clientId, type: ExtendedClientTypes.ALPHA });
    }

    public async modifyClientType(clientId: string, type: ExtendedClientTypes) {
        const db = await this.db();
        const cachedClient = this._clientCache.find((client) => client.clientId === clientId);
        if(!cachedClient) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);
        await db.createQueryBuilder(Clients, "clients")
            .update()
            .where('"uid" = :uid', 
                { uid: cachedClient.uid }
            )
            .set({ type })
            .execute();
    }
}

export const databaseManager = new DatabaseManager();