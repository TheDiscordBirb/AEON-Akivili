import { Logger } from "../logger";
import { clients } from "../structures/client";

const logger = new Logger("ClientChecks");

// TODO: ?
export const whoIs = async (guildId: string | null | undefined) => {
    if(!guildId) throw new Error("No guild id.");
    const clientsInGuild = clients.filter((client) => client.guilds.cache.has(guildId));
    const guild = clientsInGuild[0].guilds.cache.get(guildId);
    if(!guild) throw new Error("No guild.");
    if(!clientsInGuild.length) throw new Error(`Could not get bot client for ${guildId}`);
    if(clientsInGuild.length === 1) return clientsInGuild[0];
    if(!clientsInGuild[0].user) throw new Error(`No user for client.`);
    const firstClientInGuild = await guild.members.fetch(clientsInGuild[0].user.id);
    if(!firstClientInGuild) throw new Error("Could not get first client from guild.");
    let oldestJoinedClient = firstClientInGuild;
    for(const client of clientsInGuild) {
        if(!client.user) throw new Error(`No user for different client.`);
        const clientInGuild = await guild.members.fetch(client.user.id);
        if(!clientInGuild) throw new Error("Could not get differnt client from guild.");
        if(!clientInGuild.joinedTimestamp) throw new Error("No join for different client to guild.");
        if(!oldestJoinedClient.joinedTimestamp) throw new Error("No join for first client to guild.");
        if(clientInGuild.joinedTimestamp <= oldestJoinedClient.joinedTimestamp) oldestJoinedClient = clientInGuild;
    }
    const client = clients.find((client) => client.user?.id === oldestJoinedClient.user.id);
    if(!client) throw new Error("Couldnt find client in clients array.");
    return client;
}