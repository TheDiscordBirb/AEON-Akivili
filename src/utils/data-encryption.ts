import CryptoJS from 'crypto-js';
import { getEnvVar } from "./get-env-var";

class EncryptionManager {
    protected _key = getEnvVar<string>("KEY");
    
    public encrypt(str: string): string {
        return CryptoJS.AES.encrypt(str, this._key).toString();
    }

    public decrypt(str: string): string {
        return CryptoJS.AES.decrypt(str, this._key).toString(CryptoJS.enc.Utf8);
    }
}

export const encryptionManager = new EncryptionManager();