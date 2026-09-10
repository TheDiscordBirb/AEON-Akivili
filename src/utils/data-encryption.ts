import CryptoJS from 'crypto-js';
import { getEnvVar } from "./get-env-var";
import { 
    BanshareListRecord, 
    BroadcastRecord, 
    CatCakeRecord, 
    DatabaseTypes, 
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

    public databaseValueCryptoOperations(
        data: DatabaseTypes, 
        type: 'BroadcastRecord' |
        'NetworkStickerStatus' |
        'MessagesRecord' |
        'ModmailRecord' |
        'UserReactionRecord' |
        'BanshareListRecord' |
        'FilteredWordRecord' |
        'CatCakeRecord',
        operation: 'encrypt' | 'decrypt'
    ): DatabaseTypes {
        let result;
        switch(type) {
            case 'MessagesRecord': {
                data = data as MessagesRecord;
                if(operation === 'encrypt') {
                    result = {
                        ...data,
                        channelId: this.encrypt(data.channelId),
                        channelMessageId: this.encrypt(data.channelMessageId),
                        guildId: this.encrypt(data.guildId),
                        userId: this.encrypt(data.userId),
                        uniqueMessageId: this.encrypt(data.uniqueMessageId),
                        username: this.encrypt(data.username)
                    } as MessagesRecord;
                } else {
                    result = {
                        ...data,
                        channelId: this.decrypt(data.channelId),
                        channelMessageId: this.decrypt(data.channelMessageId),
                        guildId: this.decrypt(data.guildId),
                        userId: this.decrypt(data.userId),
                        uniqueMessageId: this.decrypt(data.uniqueMessageId),
                        username: this.decrypt(data.username)
                    } as MessagesRecord;
                }
                break;
            }
            case 'UserReactionRecord': {
                data = data as UserReactionRecord;
                if(operation === 'encrypt') {
                    result = {
                        uniqueMessageId: this.encrypt(data.uniqueMessageId),
                        userId: this.encrypt(data.userId),
                        reactionIdentifier: this.encrypt(data.reactionIdentifier)
                    } as UserReactionRecord;
                } else {
                    result = {
                        uniqueMessageId: this.decrypt(data.uniqueMessageId),
                        userId: this.decrypt(data.userId),
                        reactionIdentifier: this.decrypt(data.reactionIdentifier)
                    } as UserReactionRecord;
                }
                break;
            }
            case 'BroadcastRecord': {
                data = data as BroadcastRecord;
                if(operation === 'encrypt') {
                    result = {
                        ...data,
                        channelId: this.encrypt(data.channelId),
                        channelType: this.encrypt(data.channelType),
                        guildId: this.encrypt(data.guildId),
                        webhookId: this.encrypt(data.webhookId),
                        importantBanshareRoleId: this.encrypt(data.importantBanshareRoleId),
                        serviceClientId: this.encrypt(data.serviceClientId)
                    } as BroadcastRecord;
                } else {
                    result = {
                        ...data,
                        channelId: this.decrypt(data.channelId),
                        channelType: this.decrypt(data.channelType),
                        guildId: this.decrypt(data.guildId),
                        webhookId: this.decrypt(data.webhookId),
                        importantBanshareRoleId: this.decrypt(data.importantBanshareRoleId),
                        serviceClientId: this.decrypt(data.serviceClientId)
                    } as BroadcastRecord;
                }
                break;
            }
            case 'NetworkStickerStatus': {
                data = data as NetworkStickerStatus;
                if(operation === 'encrypt') {
                    result = {
                        ...data,
                        guildId: this.encrypt(data.guildId)
                    } as NetworkStickerStatus;
                } else {
                    result = {
                        ...data,
                        guildId: this.decrypt(data.guildId)
                    } as NetworkStickerStatus;
                }
                break;
            }
            case 'ModmailRecord': {
                data = data as ModmailRecord;
                if(operation === 'encrypt') {
                    result = {
                        ...data,
                        userId: this.encrypt(data.userId),
                        channelId: this.encrypt(data.channelId)
                    } as ModmailRecord;
                } else {
                    result = {
                        ...data,
                        userId: this.decrypt(data.userId),
                        channelId: this.decrypt(data.channelId)
                    } as ModmailRecord;
                }
                break;
            }
            case 'BanshareListRecord': {
                data = data as BanshareListRecord;
                if(operation === 'encrypt') {
                    result = {
                        ...data,
                        serverId: this.encrypt(data.serverId),
                        status: this.encrypt(data.status),
                        userId: this.encrypt(data.userId),
                        reason: this.encrypt(data.reason),
                        proof: this.encrypt(data.proof)
                    } as BanshareListRecord;
                } else {
                    result = {
                        ...data,
                        serverId: this.decrypt(data.serverId),
                        status: this.decrypt(data.status),
                        userId: this.decrypt(data.userId),
                        reason: this.decrypt(data.reason),
                        proof: this.decrypt(data.proof)
                    } as BanshareListRecord;
                }
                break;
            }
            case 'FilteredWordRecord': {
                data = data as FilteredWordRecord;
                if(operation === 'encrypt') {
                    result = {
                        word: this.encrypt(data.word)
                    } as FilteredWordRecord;
                } else {
                    result = {
                        word: this.decrypt(data.word)
                    } as FilteredWordRecord;
                }
                break;
            }
            case 'CatCakeRecord': {
                data = data as CatCakeRecord;
                if(operation === 'encrypt') {
                    result = {
                        uid: this.encrypt(data.uid),
                        region: this.encrypt(data.region),
                        catType: this.encrypt(data.catType)
                    } as CatCakeRecord;
                } else {
                    result = {
                        uid: this.decrypt(data.uid),
                        region: this.decrypt(data.region),
                        catType: this.decrypt(data.catType)
                    } as CatCakeRecord;
                }
                break;
            }
        }
        return result;
    }
}

export const encryptionManager = new EncryptionManager();