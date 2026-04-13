import { User, Guild } from "discord.js";
import { config, unitTest } from "../const";
import { Logger } from "../logger";
import { client, ExtendedClient } from "../structures/client";

const logger = new Logger("permUtils");

export class IsStaff {
    protected client;
    constructor(client: ExtendedClient) {
        this.client = client;
    }

    private guild = (): Guild => {
        const guild = this.client.guilds.cache.get(config.mainServerId);
        if(!guild) {
            throw new Error("Could not find guild.");
        }
        return guild;
    }

    public dev = (user: User): boolean => {
        return !!config.devIds.includes(user.id);
    }
    public conductor = (user: User): boolean => {
        const aeonGuild = this.guild();
        const aeonMember = aeonGuild.members.cache.get(user.id);
        if (!aeonMember) return false;
        return !!aeonMember.roles.cache.get(config.conductorRoleId);
    }
    public navigator = (user: User): boolean => {
        const aeonGuild = this.guild();
        const aeonMember = aeonGuild.members.cache.get(user.id);
        if (!aeonMember) return false;
        return !!aeonMember.roles.cache.get(config.navigatorRoleId);
    }
    public rep = (user: User): boolean => {
        const aeonGuild = this.guild();
        const aeonMember = aeonGuild.members.cache.get(user.id);
        if (!aeonMember) return false;
        return !!aeonMember.roles.cache.get(config.representativeRoleId);
    }
}

export const isStaff = new IsStaff(client);