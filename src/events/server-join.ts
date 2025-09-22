import { Collection, GuildMember, NonThreadGuildBasedChannel, Snowflake } from "discord.js";
import { Event } from "../structures/event";
import { notificationManager } from "../functions/notification";
import { client } from "../structures/client";
import { NotificationType } from "../types/event";

export default new Event("guildCreate", async (guild) => {
    let guildMembers: Collection<Snowflake, GuildMember>;
    let guildChannels: Collection<Snowflake, NonThreadGuildBasedChannel | null>;
    Promise.all([
        guildMembers = await guild.members.fetch(),
        guildChannels = await guild.channels.fetch()
    ]);
    const user = client.user;
    if(!user) return;
    await notificationManager.sendNotification({executingUser: user, notificationType: NotificationType.SERVER_JOIN, guild, guildData: {guildChannels, guildMembers}, privateNotification: true, time: Date.now()});
});