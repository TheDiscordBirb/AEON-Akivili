import { User, GuildTextBasedChannel } from "discord.js";
import { config, unitTest } from "../const";
import { Logger } from "../logger";
import { client, ExtendedClient } from "../structures/client";
import { mockClient } from "../tests/mocks";

const logger = new Logger("permUtils");

class IsStaff {
    protected client;
    constructor(client: ExtendedClient) {
        this.client = client;
    }

    private channel = (): GuildTextBasedChannel => {
        if(!this.client.channels.cache.get(config.aeonBanshareChannelId)) {
            throw new Error("Could not find channel.");
        }
        if(!(this.client.channels.cache.get(config.aeonBanshareChannelId) as GuildTextBasedChannel).guild) {
            throw new Error("Could not find guild.");

        }
        return (this.client.channels.cache.get(config.aeonBanshareChannelId) as GuildTextBasedChannel);
    }

    public dev = (user: User): boolean => {
        return !!config.devIds.includes(user.id);
    }
    public conductor = (user: User): boolean => {
        const aeonGuild = this.channel().guild;
        const aeonMember = aeonGuild.members.cache.get(user.id);
        if (!aeonMember) return false;
        return !!aeonMember.roles.cache.get(config.conductorRoleId);
    }
    public navigator = (user: User): boolean => {
        const aeonGuild = this.channel().guild;
        const aeonMember = aeonGuild.members.cache.get(user.id);
        if (!aeonMember) return false;
        return !!aeonMember.roles.cache.get(config.navigatorRoleId);
    }
    public rep = (user: User): boolean => {
        const aeonGuild = this.channel().guild;
        const aeonMember = aeonGuild.members.cache.get(user.id);
        if (!aeonMember) return false;
        return !!aeonMember.roles.cache.get(config.representativeRoleId);
    }
}

export const isStaff = new IsStaff(unitTest ? (mockClient as ExtendedClient) : client);