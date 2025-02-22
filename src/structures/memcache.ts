import {Cacheable} from 'cacheable';
import * as os from 'os';
import * as util from 'util'
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
       if (util.types.isUint8Array(buffer) === true) {
               const uintBuffer = Buffer.from(buffer)
               const bufferCheck = Buffer.isBuffer(uintBuffer)
               if (bufferCheck === true) {
                   return uintBuffer
               } else
               {
                   logger.wtf('Mem... Mem?????? (So... Something is very wrong here. I was just converting to a buffer and it is clearly *NOT* a buffer)')
                   mem.clear()
                   return false
               }
       } else if (buffer === undefined) {
               return false
       } else {
               logger.wtf('MEM?!??!?!? (Cache is terribly broken, restart ASAP. Gonna try clearing)')
               mem.clear()
               return false
       }
    }
}


export const cacheManager = new CacheManager();
