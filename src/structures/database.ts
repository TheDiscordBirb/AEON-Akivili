import { Logger } from '../logger';
import { DataSource } from 'typeorm';
import { 
    BanshareListRecord, 
    BroadcastRecord, 
    CachedBanshare, 
    CachedClient, 
    CachedMessage, 
    CachedModmail, 
    CachedMute, 
    CachedReaction, 
    CachedStickerStatus, 
    CatCakeRecord, 
    FilteredWordRecord, 
    MessagesRecord, 
    ModmailRecord, 
    UserReactionRecord,
    VerifiedUser
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
import { FilteredWords } from './entities/filtered-words';
import { Regions } from '../types/command';
import { CatCakes } from './entities/cat-cakes';
import { NetworkStickerStatus } from './entities/network-sticker-status';
import { Clients } from './entities/clients';
import { ExtendedClientTypes } from '../types/client';
import { ulid } from 'ulid';
import { Webhook } from 'discord.js';
import { VerifiedUsers } from './entities/verified-users';

const logger = new Logger('Database');

class DatabaseManager {
    protected _db: DataSource | null = null;
    protected cacheReady = false;
    protected _broadcastCache: BroadcastRecord[] = [];
    protected _stickerCache: CachedStickerStatus[] = [];
    protected _messageCache: CachedMessage[] = [];
    protected _clientCache: CachedClient[] = [];
    protected _reactionCache: CachedReaction[] = [];
    protected _muteCache: CachedMute[] = [];
    protected _banshareCache: CachedBanshare[] = [];
    protected _modmailCache: CachedModmail[] = [];
    protected _verifiedUserCache: VerifiedUser[] = [];

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
                Clients,
                VerifiedUsers
            ]
        });
        await this._db.initialize();
        await this._db.synchronize();
        logger.info(`Database connected.`, "GLOBAL");
        
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

    public async fillCache(): Promise<void> {
        if(this.cacheReady) return;
        const cachedMessages = await this.loadMessages();
        logger.info(`Cached ${cachedMessages.length} messages.`, "GLOBAL");
        const cachedReactions = await this.loadUserReactions();
        logger.info(`Cached ${cachedReactions.length} reactions.`, "GLOBAL");
        const cachedModmails = await this.loadActiveModmails();
        logger.info(`Cached ${cachedModmails.length} modmails.`, "GLOBAL");
        const cachedBanshares = await this.loadBanshares();
        logger.info(`Cached ${cachedBanshares.length} banshares.`, "GLOBAL");
        const cachedVerifiedUsers = await this.loadVerifiedUsers();
        logger.info(`Cached ${cachedVerifiedUsers.length} verified users.`, "GLOBAL");
        this.cacheReady = true;
    }

    public async disconnect(): Promise<void> {
        const db = await this.db();
        await db.destroy();
        this._db = null;
        logger.info('Database disconnected', "GLOBAL")
    }

    public async db(): Promise<DataSource> {
        if(this._db) return this._db;
        this._db = await this.connect();
        return this._db;
    }
    
    public async saveBroadcast(broadcastRecord: BroadcastRecord, webhook: Webhook): Promise<void> {
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
        config.activeWebhooks.push(webhook);
    }

    public async updateBroadcast(broadcastRecord: BroadcastRecord): Promise<void> {
        const db = await this.db();
        await db.createQueryBuilder(Broadcasts, "broadcasts")
            .update()
            .where('"broadcastUid" = :broadcastUid',
                { broadcastUid: broadcastRecord.broadcastUid }
            )
            .set({ ...broadcastRecord })
            .execute();
        this._broadcastCache.splice(this._broadcastCache.findIndex((b) => b.broadcastUid === broadcastRecord.broadcastUid), 1, broadcastRecord)
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
        const broadcasts = await this.getBroadcasts();
        const broadcast = broadcasts.find((broadcast) => broadcast.webhookId === webhookId);
        if(!broadcast) throw new Error(ErrorNames.NO_BROADCAST_IN_CACHE);
        await db.createQueryBuilder(Broadcasts, "broadcasts")
            .delete()
            .where('"broadcastUid" = :broadcastUid', { broadcastUid: broadcast.broadcastUid })
            .execute();

        const idx = this._broadcastCache.findIndex((cacheElement) => cacheElement.webhookId === webhookId);
        if (idx !== -1) {
            this._broadcastCache.splice(idx, 1);
        }
        config.activeWebhooks.splice(
            config.activeWebhooks.findIndex((activeWebhook) => activeWebhook.id === broadcast.webhookId),
            1
        )
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

    public async loadMessages(): Promise<CachedMessage[]> {
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
        return this._messageCache;
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
        if(!cachedUids.length) {
            logger.info(`Db was already empty.`, "GLOBAL");
            return;
        }
        await db.createQueryBuilder(Messages, "messages")
            .delete()
            .where('"messageUid" NOT IN (:...messageUids)', { messageUids: cachedUids })
            .execute();
        await db.createQueryBuilder(UserReactions, "user_reactions")
            .delete()
            .where('"messageUid" NOT IN (:...messageUids)', { messageUids: cachedUids })
            .execute();
        logger.info('Db was cleared.', "GLOBAL");
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

    public async loadUserReactions(): Promise<CachedReaction[]> {
        if(this._reactionCache.length) return this._reactionCache;
        const db = await this.db();
        this._reactionCache = await db.createQueryBuilder(UserReactions, "user_reactions")
            .select()
            .getMany();
        return this._reactionCache;
    }
    
    public async toggleUserReaction(userReactionRecord: UserReactionRecord, onlyDelete = false): Promise<void> {
        const db = await this.db();
        const cachedReaction = this._reactionCache.find((reaction) => 
            reaction.messageUid === userReactionRecord.messageUid &&
            reaction.userId === userReactionRecord.userId &&
            reaction.reactionIdentifier === userReactionRecord.reactionIdentifier
        );
        if(cachedReaction) {
            if(!onlyDelete) return;
            await db.createQueryBuilder(UserReactions, "user_reactions")
                .delete()
                .where('"reactionUid" = :reactionUid AND "messageUid" = :messageUid',
                    { reactionUid: cachedReaction.reactionUid, messageUid: cachedReaction.messageUid }
                )
                .execute();
            this._reactionCache.splice(this._reactionCache.indexOf(cachedReaction), 1);
        } else {
            const reactionUid = ulid();
            await db.createQueryBuilder(UserReactions, "user_reactions")
                .insert()
                .values([{
                    ...userReactionRecord,
                    reactionUid
                }])
                .execute();
            this._reactionCache.push({ ...userReactionRecord, reactionUid });
        }
    }

    public async hasUserReactedToMessage(userReactionRecord: UserReactionRecord): Promise<boolean> {
        return !!this._reactionCache.find((cachedReaction) => 
            cachedReaction.userId === userReactionRecord.userId &&
            cachedReaction.messageUid === userReactionRecord.messageUid &&
            cachedReaction.reactionIdentifier === userReactionRecord.reactionIdentifier
        );
    }

    public async getReactionCountForMessage(messageUid: string): Promise<number> {
        const db = await this.db();
        return await db.createQueryBuilder(UserReactions, "user_reactions")
            .select()
            .where('"messageUid" = :messageUid', { messageUid })
            .getCount();
    }

    public async hasUserBeenMutedOnNetworkChat(userId: string): Promise<boolean> {
        return !!this._muteCache.find((cachedMute) => cachedMute.userId === userId);
    }

    public async whoMutedUser(userId: string): Promise<string> {
        const entry = this._muteCache.find((cachedMute) => cachedMute.userId === userId);
        if(!entry) throw new Error(ErrorNames.NO_MUTE_INFO);
        return entry.staffId;
    }

    public async toggleNetworkChatMute(userId: string, staffId: string): Promise<void> {
        const db = await this.db();
        const current = this._muteCache.find((cachedMute) => cachedMute.userId === userId);
        if(current) {
            await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
                .delete()
                .where('"muteUid" = :muteUid', { muteUid: current.muteUid })
                .execute();
            this._muteCache.splice(this._muteCache.indexOf(current), 1);
        } else {
            const muteUid = ulid();
            await db.createQueryBuilder(NetworkChatMutedUsers, "network_chat_muted_users")
                .insert()
                .values([{ muteUid, userId, staffId }])
                .execute();
            this._muteCache.push({ muteUid, userId, staffId });
        }
    }

    public async loadActiveModmails(): Promise<ModmailRecord[]> {
        const db = await this.db();
        if(this._modmailCache.length) return this._modmailCache;
        return await db.createQueryBuilder(Modmails, "modmails")
            .select()
            .where('"active" = true')
            .getMany();
    }

    public getModmail(channelId: string): ModmailRecord {
        let result = this._modmailCache.find((cachedModmail) => cachedModmail.channelId === channelId);
        if(!result) throw new Error(ErrorNames.NO_MODMAIL_IN_CACHE);
        return result;
    }

    public async getModmailByUserId(userId: string): Promise<ModmailRecord | undefined> {
        let result = this._modmailCache.find((cachedModmail) => cachedModmail.userId === userId);
        return result;
    }
    
    public async createModmail(userId: string, channelId: string): Promise<void> {
        const db = await this.db();
        const modmailUid = ulid();

        await db.createQueryBuilder(Modmails, "modmails")
            .insert()
            .values([{ modmailUid, userId, channelId, active: true }])
            .execute();
        this._modmailCache.push({ modmailUid, userId, channelId, active: true });
    }
    
    public async closeModmail(channelId: string) {
        const db = await this.db();
        const modmail = this.getModmail(channelId);
        await db.createQueryBuilder(Modmails, "modmails")
            .update()
            .where('"modmailUid" = :modmailUid AND "active" = true', 
                { modmailUid: modmail.modmailUid}
            )
            .set({ active: false })
            .execute();
        this._modmailCache.splice(this._modmailCache.indexOf(modmail), 1)
    }

    public async loadBanshares(): Promise<CachedBanshare[]> {
        if(this._banshareCache.length) return this._banshareCache;
        const db = await this.db();
        return await db.createQueryBuilder(Banshares, "banshares")
            .select()
            .getMany();
    }

    public async getBanshareList(serverId: string): Promise<BanshareListRecord[]> {
        const db = await this.db();
        const banshareUids = this._banshareCache.reduce<string[]>(((acc, item) => {
            if(item.serverId === serverId) {
                acc.push(item.banshareUid);
            }
            return acc;
        }), []);
        if(!banshareUids.length) return [];
        return await db.createQueryBuilder(Banshares, "banshares")
            .select()
            .where('"banshareUid" IN (:...banshareUids)', { banshareUids })
            .getMany();
    }

    public async registerBanshare(banshareListRecord: BanshareListRecord): Promise<void> {
        const db = await this.db();
        const banshareUid = ulid();
        await db.createQueryBuilder(Banshares, "banshares")
            .insert()
            .values([{ ...banshareListRecord, banshareUid }])
            .execute();
        this._banshareCache.push({ ...banshareListRecord, banshareUid });
    }

    public async updateBanshareStatus(serverId: string, userId: string, status: string): Promise<void> {
        const db = await this.db();
        const cachedBanshare = this._banshareCache.find((banshare) => banshare.serverId === serverId && banshare.userId === userId);
        if(!cachedBanshare) throw new Error(ErrorNames.NO_BANSHARE_IN_CACHE);
        await db.createQueryBuilder(Banshares, "banshares")
            .update()
            .where('"banshareUid" = :banshareUid', { banshareUid: cachedBanshare.banshareUid })
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
        if(this._stickerCache.length) return this._stickerCache;
        const db = await this.db();
        return await db.createQueryBuilder(NetworkStickerStatus, "network_sticker_status")
            .select()
            .getMany();
    }

    public async getServerStickerStatus(serverId: string): Promise<boolean | null> {
        const allServerStickerStatus = await this.getAllServerStickerStatus();
        const serverStickerStatus = allServerStickerStatus.find((guild) => guild.guildId === serverId)?.status;
        if(serverStickerStatus === undefined) return null;
        return serverStickerStatus;
    }

    public async saveServerStickerStatus(guildId: string, status: boolean): Promise<void> {
        const statusInDb = await this.getServerStickerStatus(guildId);
        if(statusInDb) throw new Error(ErrorNames.DB_ENTRY_ALREADY_EXISTS);
        const db = await this.db();
        const stickerUid = ulid();

        await db.createQueryBuilder(NetworkStickerStatus, "network_sticker_status")
            .insert()
            .values([{ stickerUid, guildId, status }])
            .execute();
        this._stickerCache.push({ stickerUid, guildId, status });
        logger.info(`${status ? "Enabled" : "Disabled"} stickers from ${guildId}`, "GLOBAL");
    }

    public async modifyServerStickerStatus(guildId: string, status: boolean): Promise<void> {
        const statusInDb = await this.getServerStickerStatus(guildId);
        if(!statusInDb) throw new Error(ErrorNames.NO_DB_ENTRY);
        if(statusInDb === status) throw new Error(ErrorNames.DID_NOT_MODIFY_DB_DATA);
        const cachedSticker = this._stickerCache.find((stickerStatus) => stickerStatus.guildId === guildId);
        if(!cachedSticker) throw new Error(ErrorNames.NO_STICKER_STATUS_IN_CACHE);
        const db = await this.db();

        await db.createQueryBuilder(NetworkStickerStatus, "network_sticker_status")
            .update()
            .where('"stickerUid" = :stickerUid', { stickerUid: cachedSticker.stickerUid })
            .set({ ...cachedSticker, status })
            .execute();
        this._stickerCache.splice(
            this._stickerCache.indexOf({ ...cachedSticker }),
            1,
            { ...cachedSticker, status }
        )
        logger.info(`${status ? "Enabled" : "Disabled"} stickers from ${guildId}`, "GLOBAL");
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
        const clientUid = ulid();
        await db.createQueryBuilder(Clients, "clients")
            .insert()
            .into(Clients)
            .values([{
                clientUid,
                clientId,
                type: ExtendedClientTypes.ALPHA
            }])
            .execute();
        this._clientCache.push({ clientUid, clientId, type: ExtendedClientTypes.ALPHA });
    }

    public async modifyClientType(clientId: string, type: ExtendedClientTypes) {
        const db = await this.db();
        const cachedClient = this._clientCache.find((client) => client.clientId === clientId);
        if(!cachedClient) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);
        await db.createQueryBuilder(Clients, "clients")
            .update()
            .where('"clientUid" = :clientUid', 
                { clientUid: cachedClient.clientUid }
            )
            .set({ type })
            .execute();

        this._clientCache.splice(
            this._clientCache.findIndex((c) => c.clientId === cachedClient.clientId),
            1,
            { ...cachedClient, type }
        )
    }

    public async saveVerifiedUser(verifiedUser: VerifiedUser): Promise<VerifiedUser> {
        const db = await this.db();
        await db.createQueryBuilder(VerifiedUsers, "verified_user")
            .insert()
            .into(VerifiedUsers)
            .values({ ...verifiedUser })
            .execute();

        this._verifiedUserCache.push({ ...verifiedUser });
        return verifiedUser;
    }

    public async updateVerificationTime(verifiedUser: VerifiedUser, timestamp: string) {
        const db = await this.db();
        const cachedVerifiedUser = this._verifiedUserCache.find(
            (cachedVerifiedUser) => cachedVerifiedUser.userId === verifiedUser.userId
        );
        if(!cachedVerifiedUser) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);
        await db.createQueryBuilder(VerifiedUsers, "verified_user")
            .update()
            .where('"verifiedUserUid" = :verifiedUserUid', 
                { verifiedUserUid: verifiedUser.userId }
            )
            .set({ timestamp })
            .execute();

        this._verifiedUserCache.splice(
            this._verifiedUserCache.indexOf(cachedVerifiedUser),
            1,
            { ...cachedVerifiedUser, timestamp }
        )
    }

    public async updateAgreementStatus(verifiedUser: VerifiedUser, agreed: boolean, timestamp: string) {
        const db = await this.db();
        const cachedVerifiedUser = this._verifiedUserCache.find(
            (cachedVerifiedUser) => cachedVerifiedUser.userId === verifiedUser.userId
        );
        if(!cachedVerifiedUser) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);
        await db.createQueryBuilder(VerifiedUsers, "verified_user")
            .update()
            .where('"verifiedUserUid" = :verifiedUserUid', 
                { verifiedUserUid: verifiedUser.userId }
            )
            .set({ agreed, timestamp })
            .execute();

        this._verifiedUserCache.splice(
            this._verifiedUserCache.indexOf(cachedVerifiedUser),
            1,
            { ...cachedVerifiedUser, agreed, timestamp }
        )
    }

    public async loadVerifiedUsers(): Promise<VerifiedUser[]> {
        if(this._verifiedUserCache.length) return this._verifiedUserCache;
        const db = await this.db();
        this._verifiedUserCache = await db.createQueryBuilder(VerifiedUsers, "verified_users")
            .select()
            .getMany();
        return this._verifiedUserCache;
    }

    public getVerifiedUser(userId: string): VerifiedUser | undefined {
        const verifiedUserId = this._verifiedUserCache.find((u) => u.userId === userId)
        return verifiedUserId;
    }
}

export const databaseManager = new DatabaseManager();