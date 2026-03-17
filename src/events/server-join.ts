import { ClientUser, Collection, Guild, GuildMember, NonThreadGuildBasedChannel, Snowflake } from "discord.js";
import { Event } from "../structures/event";
import { notificationManager } from "../functions/notification";
import { client } from "../structures/client";
import { NotificationType } from "../types/event";
import { config } from "../const";

export default new Event("guildCreate", async (guild) => {
    const notification = await serverJoinMakeNotification(guild);
    await notificationManager.sendNotification(notification);
});

export const serverJoinMakeNotification = async (guild: Guild): Promise<{
    executingUser: ClientUser,
    notificationType: NotificationType,
    guild: Guild,
    guildData: {guildChannels: Collection<string, NonThreadGuildBasedChannel | null>, 
        guildMembers: Collection<string, GuildMember>},
    privateNotification: boolean,
    time: number
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
        privateNotification: true,
        time: Date.now()
    }
}