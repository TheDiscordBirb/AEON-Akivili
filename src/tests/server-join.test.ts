import { serverJoinMakeNotification } from "../events/server-join"
import { mockClient, networkGuilds } from "./mocks"
import { ExtendedClient } from "../structures/client"
import { Guild } from "discord.js"
import { config } from "../const"
import { NotificationType } from "../types/event"

const networkGuild1 = networkGuilds[0];
test("Server joins during startup", async () => {
    config.botStarting = true;
    await expect(() => serverJoinMakeNotification((mockClient as ExtendedClient), (networkGuild1.guild as Guild))).rejects.toThrow(/Bot is starting/);
    config.botStarting = false;
});

test("Client user is undefined", async () => {
    const mock2Client = {...mockClient};
    mock2Client.user = undefined;
    await expect(() => serverJoinMakeNotification((mock2Client as ExtendedClient), (networkGuild1.guild as Guild))).rejects.toThrow(/Could not find user/);
});


export interface dateInterface {
    time: number
};
export const testDate: dateInterface = {
    time: 0
};

test("Server join successful", async () => {
    expect(await serverJoinMakeNotification((mockClient as ExtendedClient), (networkGuild1.guild as Guild))).toStrictEqual({
            executingUser: (mockClient as ExtendedClient).user,
            notificationType: NotificationType.SERVER_JOIN,
            guild: (networkGuild1.guild as Guild),
            guildData: {
                guildChannels: await networkGuild1.guild.channels?.fetch(),
                guildMembers: await networkGuild1.guild.members?.fetch()
            },
            privateNotification: true
        });
})

