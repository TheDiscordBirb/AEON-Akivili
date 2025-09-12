import { Cacheable } from "cacheable";
import * as os from 'os';
import * as util from 'util';
import { Logger } from '../logger';
import { config } from "../const";

const logger = new Logger('Memcache');

class CacheManager {
    protected _mem: Cacheable = new Cacheable();
    public async saveCache(record: 'emoji' | 'sticker', key: string, value: Buffer): Promise<Boolean> {
        const mem = this._mem;
        if(os.freemem()/os.totalmem() > 0.85) {
            logger.info('Mem mem mem (Mem is clearing the cache, you are running out of memory)');
            mem.clear();
            config.cachedEmojiDictionaries = [];
        }
        return await mem.set(''.concat(...[record, key.toString()]), value);
    }

    public async retrieveCache(record: 'emoji' | 'sticker', key: string): Promise<Buffer<ArrayBuffer> | undefined> {
        const mem = this._mem;
        const buffer = await mem.get(''.concat(...[record, key.toString()]));
        if(util.types.isUint8Array(buffer)) {
            const uintBuffer = Buffer.from(buffer);
            if(Buffer.isBuffer(uintBuffer)) {
                return uintBuffer;
            } else {
                logger.wtf('Mem... Mem?????? (So... Something is very wrong here. I was just converting to a buffer and it is clearly *NOT* a buffer)');
                mem.clear();
                config.cachedEmojiDictionaries = [];
                return;
            }
        } else if(!buffer) {
            logger.warn(`Memi mem mem. (Could not get buffer from ${key.toString()})`);
            return;
        } else {
            logger.warn('MEM?!??!?!? (Cache is terribly broken, restart ASAP. Gonna try clearing)')
            mem.clear()
            config.cachedEmojiDictionaries = [];
            return;
        }
    }
}

export const cacheManager = new CacheManager();