import { Cacheable } from "cacheable";
import * as os from 'os';
import * as util from 'util';
import { Logger } from '../logger';
import { config } from "../const";

const logger = new Logger('Memcache');

class CacheManager {
    protected _mem: Cacheable = new Cacheable();
    public async saveCache(record: 'emoji' | 'sticker', key: string, value: Buffer<ArrayBuffer>): Promise<Boolean> {
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
        const buffer = await mem.get<Buffer<ArrayBuffer>>(''.concat(...[record, key.toString()]));
        if(!buffer) {
            logger.warn(`Memi mem mem. (Could not get buffer from ${key.toString()})`);
            return;
        } else if(Buffer.isBuffer(buffer)) {
            return buffer;
        } else {
            logger.warn(`MEM?!??!?!? (Cache returned ${typeof(buffer)} instead of Buffer<ArrayBuffer>, restart ASAP. Gonna try clearing)`);
            mem.clear()
            config.cachedEmojiDictionaries = [];
            return;
        }
    }

    public async emptyCache() {
        const mem = this._mem;
        mem.clear();
        logger.info('MEM MEM. (Cache has been cleared by force.)');
    }
}

export const cacheManager = new CacheManager();