import { 
    Client,
    ClientUser,
    Collection,
    Guild,
    GuildMember,
    NonThreadGuildBasedChannel,
    Snowflake
} from "discord.js";
import { Event } from "../structures/event";
import { notificationManager } from "../functions/notification";
import { NotificationType } from "../types/event";
import { config } from "../const";
import { clients, ExtendedClient } from "../structures/client";
import { Logger } from "../logger";
import { whoIs } from "../utils/client-checks";

const logger = new Logger("ServerJoin");

export default new Event("guildCreate", async (guild) => {
    let client: ExtendedClient;
    try {
        client = await whoIs(guild);
    } catch(e) {
        logger.error((e as Error).message, e as Error);
        return;
    }
    
    try {
        const newClient = clients.find((c) => c.guilds.cache.has(guild.id) && 
        (clients.filter((cF) => cF.guilds.cache.has(guild.id)).length > 1 ? c != client : c));
        if(!newClient) return;
        const clientFull = await isClientFull(newClient, guild);
        if(clientFull) {
            await guild.leave();
            return;
        }
        const otherClients = await checkForOtherAEONChatBots(newClient, guild);
        if(otherClients) {
            await guild.leave();
            return;
        }
        const notification = await serverJoinMakeNotification(newClient, guild);
        await notificationManager.sendNotification({...notification, time: Date.now()});
    } catch(e) {
        logger.error((e as Error).message, e as Error);
        await guild.leave();
    }
});

export const serverJoinMakeNotification = async (client: Client, guild: Guild): Promise<{
    executingUser: ClientUser,
    notificationType: NotificationType,
    guild: Guild,
    guildData: {guildChannels: Collection<string, NonThreadGuildBasedChannel | null>, 
    guildMembers: Collection<string, GuildMember>},
    privateNotification: boolean
}> => {
    if(config.botStarting) throw new Error("Bot is starting");
    let guildMembers: Collection<Snowflake, GuildMember>;
    let guildChannels: Collection<Snowflake, NonThreadGuildBasedChannel | null>;
    await Promise.all([
        guildMembers = await guild.members.fetch(),
        guildChannels = await guild.channels.fetch()
    ]);
    const user = client.user;
    if(!user) throw new Error("Could not find user.");
    return {
        executingUser: user,
        notificationType: NotificationType.SERVER_JOIN,
        guild,
        guildData: {guildChannels, guildMembers},
        privateNotification: true
    }
}

export const isClientFull = async (client: Client, guild: Guild): Promise<boolean> => {
    const owner = await client.users.fetch(guild.ownerId);
    if(!owner) throw new Error("Could not find guild owner.");
    await client.guilds.fetch();
    if(client.guilds.cache.size >= config.maxServerPerClient) {
        const mainGuild = clients.find((client) => client.guilds.cache.get(config.mainServerId))?.guilds.cache.get(config.mainServerId);
        if(!mainGuild) throw new Error("Could not get main guild.");
        try {
            await owner.createDM();
            await owner.send({content: `This bot instance is servicing too many servers, please make a ticket by messagin ${config.clientName} in ${mainGuild.name}\n${(await mainGuild.invites.fetch()).first()}`});
            return true;
        } catch(e) {
            return true;
        }
    }
    return false;
}

export const checkForOtherAEONChatBots = async (client: Client, guild: Guild): Promise<boolean> => {
    for(const otherClient of clients) {
        if(!otherClient.user) throw new Error(`Couldnt get user for a bot client.`);
        if(!client.user) throw new Error("Couldnt get user for bot client.");
        if(guild.members.cache.has(otherClient.user.id)) {
            if(otherClient.user.id !== client.user.id) {
                const owner = await client.users.fetch(guild.ownerId);
                if(!owner) throw new Error("Could not find guild owner.");
                try {
                    await owner.createDM();
                    await owner.send({content: `${guild.name} already has an Akivili instance, so this one will be removed.`});
                    return true;
                } catch(e) {
                    return true;
                }
            }
        }
    }
    return false;
}