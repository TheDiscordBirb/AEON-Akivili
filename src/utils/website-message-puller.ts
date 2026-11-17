import Cloudflare from 'cloudflare';
import { getEnvVar } from './get-env-var';
import { BanshareRecord } from '../types/event';



export const getQueuedBanshares = async () => {
    const queuedBanshares: BanshareRecord[] = []
    const client = new Cloudflare({
        apiToken: getEnvVar<string>("CLOUDFLARE_QUEUE_ACCESS_TOKEN"),
    });
    const response = await client.queues.messages.pull(getEnvVar<string>("CLOUDFLARE_QUEUE_ID"), {
      account_id: getEnvVar<string>("CLOUDFLARE_ACCOUNT_ID"),
    });
    if(!response.messages?.length) return queuedBanshares;
    for(const queuedBanshare of response.messages) {
        if(!queuedBanshare.body) throw new Error("Err");
        try {
            const parsedBanshare = JSON.parse(queuedBanshare.body) as BanshareRecord;
            queuedBanshares.push(parsedBanshare);
        } catch(e) {
            console.log("err2");
        }
    }/*
    try {
        const a = await client.queues.messages.ack(getEnvVar<string>("CLOUDFLARE_QUEUE_ID"), {
            account_id: getEnvVar<string>("CLOUDFLARE_ACCOUNT_ID"),
        })
        console.log(a.warnings);
    } catch(e) {
        console.log(e as Error)
    }*/
    return queuedBanshares;
}
