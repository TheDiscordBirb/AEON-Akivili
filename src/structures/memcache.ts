import {Cacheable} from 'cacheable';
import * as os from 'os';
import { Logger } from "../logger";

const logger = new Logger('Mem');

class CacheManager {
    protected _mem: Cacheable = new Cacheable();
    public async saveCache(record: 'emoji' | 'sticker', key: string, value: Buffer): Promise<boolean> {
           const mem = await this._mem;
           const memValue = os.freemem() /os.totalmem()
           if (memValue> 0.85) {
               logger.info('Mem mem mem (Mem is clearing the cache, you are running out of memory)')
               mem.clear()
           }
           const cached = await mem.set(''.concat(...[record, key.toString()]), value)
           return cached
    }
    
    public async retrieveCache(record: 'emoji' | 'sticker', key: string): Promise<Buffer | false> {
        const mem = await this._mem;
        const buffer = await mem.get(''.concat(...[record, key.toString()]))
        const bufferCheck = Buffer.isBuffer(buffer)
        if (bufferCheck) {
            return buffer
        } else
        {
            return false
        }
    }
}


export const cacheManager = new CacheManager();
