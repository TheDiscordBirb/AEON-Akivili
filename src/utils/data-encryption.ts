import CryptoJS from 'crypto-js';
import { getEnvVar } from "./get-env-var";
import { 
    BanshareListRecord, 
    BroadcastRecord, 
    CatCakeRecord, 
    DatabaseTypes, 
    DatabaseTypesEnum, 
    FilteredWordRecord, 
    MessagesRecord, 
    ModmailRecord, 
    NetworkStickerStatus, 
    UserReactionRecord 
} from '../types/database';

class EncryptionManager {
    protected _key = getEnvVar<string>("KEY");
    
    public encrypt(str: string): string {
        return CryptoJS.AES.encrypt(str, this._key).toString();
    }

    public decrypt(str: string): string {
        return CryptoJS.AES.decrypt(str, this._key).toString(CryptoJS.enc.Utf8);
    }

    public encryptComplexDataType(
        data: DatabaseTypes,
    ): DatabaseTypes {
        let result;
        switch(data.type) {
            case DatabaseTypesEnum.MESSAGES_RECORD: {
                data = data as MessagesRecord;
                result = {
                    ...data,
                    channelId: this.encrypt(data.channelId),
                    channelMessageId: this.encrypt(data.channelMessageId),
                    guildId: this.encrypt(data.guildId),
                    userId: this.encrypt(data.userId),
                    uniqueMessageId: this.encrypt(data.uniqueMessageId),
                    username: this.encrypt(data.username)
                } as MessagesRecord;
                break;
            }
            case DatabaseTypesEnum.USER_REACTION_RECORD: {
                data = data as UserReactionRecord;
                result = {
                    uniqueMessageId: this.encrypt(data.uniqueMessageId),
                    userId: this.encrypt(data.userId),
                    reactionIdentifier: this.encrypt(data.reactionIdentifier)
                } as UserReactionRecord;
                break;
            }
            case DatabaseTypesEnum.BROADCAST_RECORD: {
                data = data as BroadcastRecord;
                result = {
                    ...data,
                    channelId: this.encrypt(data.channelId),
                    channelType: this.encrypt(data.channelType),
                    guildId: this.encrypt(data.guildId),
                    webhookId: this.encrypt(data.webhookId),
                    importantBanshareRoleId: this.encrypt(data.importantBanshareRoleId),
                    serviceClientId: this.encrypt(data.serviceClientId)
                } as BroadcastRecord;
                break;
            }
            case DatabaseTypesEnum.NETWORK_STICKER_STATUS: {
                data = data as NetworkStickerStatus;
                result = {
                    ...data,
                    guildId: this.encrypt(data.guildId)
                } as NetworkStickerStatus;
                break;
            }
            case DatabaseTypesEnum.MODMAIL_RECORD: {
                data = data as ModmailRecord;
                result = {
                    ...data,
                    userId: this.encrypt(data.userId),
                    channelId: this.encrypt(data.channelId)
                } as ModmailRecord;
                break;
            }
            case DatabaseTypesEnum.BANSHARE_LIST_RECORD: {
                data = data as BanshareListRecord;
                result = {
                    ...data,
                    serverId: this.encrypt(data.serverId),
                    status: this.encrypt(data.status),
                    userId: this.encrypt(data.userId),
                    reason: this.encrypt(data.reason),
                    proof: this.encrypt(data.proof)
                } as BanshareListRecord;
                break;
            }
            case DatabaseTypesEnum.FILTERED_WORD_RECORD: {
                data = data as FilteredWordRecord;
                result = {
                    word: this.encrypt(data.word)
                } as FilteredWordRecord;
                break;
            }
            case DatabaseTypesEnum.CAT_CAKE_RECORD: {
                data = data as CatCakeRecord;
                result = {
                    uid: this.encrypt(data.uid),
                    region: this.encrypt(data.region),
                    catType: this.encrypt(data.catType)
                } as CatCakeRecord;
                break;
            }
        }
        return result;
    }

    public decryptComplexDataType(
        data: DatabaseTypes,
    ): DatabaseTypes {
        let result;
        switch(data.type) {
            case DatabaseTypesEnum.MESSAGES_RECORD: {
                data = data as MessagesRecord;
                result = {
                    ...data,
                    channelId: this.decrypt(data.channelId),
                    channelMessageId: this.decrypt(data.channelMessageId),
                    guildId: this.decrypt(data.guildId),
                    userId: this.decrypt(data.userId),
                    uniqueMessageId: this.decrypt(data.uniqueMessageId),
                    username: this.decrypt(data.username)
                } as MessagesRecord;
                break;
            }
            case DatabaseTypesEnum.USER_REACTION_RECORD: {
                data = data as UserReactionRecord;
                result = {
                    uniqueMessageId: this.decrypt(data.uniqueMessageId),
                    userId: this.decrypt(data.userId),
                    reactionIdentifier: this.decrypt(data.reactionIdentifier)
                } as UserReactionRecord;
                break;
            }
            case DatabaseTypesEnum.BROADCAST_RECORD: {
                data = data as BroadcastRecord;
                result = {
                    ...data,
                    channelId: this.decrypt(data.channelId),
                    channelType: this.decrypt(data.channelType),
                    guildId: this.decrypt(data.guildId),
                    webhookId: this.decrypt(data.webhookId),
                    importantBanshareRoleId: this.decrypt(data.importantBanshareRoleId),
                    serviceClientId: this.decrypt(data.serviceClientId)
                } as BroadcastRecord;
                break;
            }
            case DatabaseTypesEnum.NETWORK_STICKER_STATUS: {
                data = data as NetworkStickerStatus;
                result = {
                    ...data,
                    guildId: this.decrypt(data.guildId)
                } as NetworkStickerStatus;
                break;
            }
            case DatabaseTypesEnum.MODMAIL_RECORD: {
                data = data as ModmailRecord;
                result = {
                    ...data,
                    userId: this.decrypt(data.userId),
                    channelId: this.decrypt(data.channelId)
                } as ModmailRecord;
                break;
            }
            case DatabaseTypesEnum.BANSHARE_LIST_RECORD: {
                data = data as BanshareListRecord;
                result = {
                    ...data,
                    serverId: this.decrypt(data.serverId),
                    status: this.decrypt(data.status),
                    userId: this.decrypt(data.userId),
                    reason: this.decrypt(data.reason),
                    proof: this.decrypt(data.proof)
                } as BanshareListRecord;
                break;
            }
            case DatabaseTypesEnum.FILTERED_WORD_RECORD: {
                data = data as FilteredWordRecord;
                result = {
                    word: this.decrypt(data.word)
                } as FilteredWordRecord;
                break;
            }
            case DatabaseTypesEnum.CAT_CAKE_RECORD: {
                data = data as CatCakeRecord;
                result = {
                    uid: this.decrypt(data.uid),
                    region: this.decrypt(data.region),
                    catType: this.decrypt(data.catType)
                } as CatCakeRecord;
                break;
            }
        }
        return result;
    }
}

export const encryptionManager = new EncryptionManager();