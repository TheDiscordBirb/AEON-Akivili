import {
    ChannelManager,
    ChannelType,
    ClientUser,
    Collection,
    Guild,
    GuildBasedChannel,
    GuildChannelManager,
    GuildManager,
    GuildMember,
    GuildMemberManager,
    NonThreadGuildBasedChannel,
    Role,
    RoleManager,
    User,
    Channel
} from "discord.js"
import { PermissionLocal } from "../structures/types";
import { ExtendedClient } from "../structures/client";
import { config } from "../const";

// Roles
export const aeonRoles: Partial<Role>[] = [{
    name: "Rep",
    id: config.representativeRoleId,
    toString() {
        return `<@&${this.id}>`
    },
    valueOf() {
        return config.representativeRoleId
    }
}, {
    name: "Navigator",
    id: config.navigatorRoleId,
    toString() {
        return `<@&${this.id}>`
    },
    valueOf() {
        return config.navigatorRoleId
    }
},{
    name: "Conductor",
    id: config.conductorRoleId,
    toString() {
        return `<@&${this.id}>`
    },
    valueOf() {
        return config.conductorRoleId
    }
}];

export const aeonChannels = new Collection<string, GuildBasedChannel>()
.set(config.aeonBanshareChannelId, {
    name: "BanshareChannel",
    type: ChannelType.GuildText,
    id: config.aeonBanshareChannelId,
    toString() {
        return `<#${config.aeonBanshareChannelId}>`
    },
    valueOf: () => `<#${config.aeonBanshareChannelId}>`
} as GuildBasedChannel);


// Mock user generator
class UserGenerator {
    public id: string;
    constructor(id: string) {
        this.id = id
        this.user.id = id
    };

    public user: Partial<User> = {
        equals: (user: User) => {
            return user.id === this.id;
        },
        toString() {
            return `<@${this.id}>`
        },
        valueOf: () => `<@${this.id}>`,
    };
};

// User id schema:
// 0: bot client user
// 1-6: set users
// 10-999: generic users
// 1000-1099: mod users
// 1100-1199: rep users
// 1200-1299: navigator users
export const genUser = new UserGenerator("1");
export const modUser = new UserGenerator("2");
export const repUser = new UserGenerator("3");
export const navigatorUser = new UserGenerator("4");
export const conductorUser = new UserGenerator("5");
export const devUser = new UserGenerator(config.devIds[0]);

export const genUsers: UserGenerator[] = [];
export const modUsers: UserGenerator[] = [];
export const repUsers: UserGenerator[] = [];
export const navigatorUsers: UserGenerator[] = [];
const genUserNum = 10;
const modUserNum = 1000;
const repUserNum = 1100;
const navigatorUserNum = 1200;
for(let i = 10; i < genUserNum; i++) {
    genUsers.push(new UserGenerator(String(i)));
};
for(let i = 1000; i < modUserNum; i++) {
    modUsers.push(new UserGenerator(String(i)));
};
for(let i = 1100; i < repUserNum; i++) {
    repUsers.push(new UserGenerator(String(i)));
};
for(let i = 1200; i < navigatorUserNum; i++) {
    navigatorUsers.push(new UserGenerator(String(i)));
};

export const fakeChannels = (): Partial<Collection<string, GuildBasedChannel>> => {
    return new Collection<string, GuildBasedChannel>();
}


// Mock guild generator
export class GuildGenerator {
    constructor(
        protected channels: Partial<Collection<string, GuildBasedChannel>> = fakeChannels(),
        protected roles: Partial<Role>[],
        protected members: Partial<Collection<string, GuildMember>>,
        protected uid: string ) {
        this.channels = channels
        this.members = members
        this.roles = roles
        this.uid = uid
        this.guild.id = uid
    };
    
    private channelsCache: Partial<Collection<string, GuildBasedChannel>> = { 
        constructor: undefined,
        get: (key: string) => {
            if((!!this.channels) && (!!this.channels.find)) {
                return (this.channels.find((channel) => channel.id === key) as GuildBasedChannel)
            }
            return undefined;
        },
        has: (key: string) => {
            if((!!this.channels) && (!!this.channels.find)) {
                return !!(this.channels.find((channel) => channel.id === key) as GuildBasedChannel)
            }
            return false;
        },
        forEach: (callbackFn, thisArg) => {
            if((!!this.channels) && (!!this.channels.entries)) {
                const entries = this.channels.entries();
                for(const entry of entries) {
                    callbackFn(entry[1], entry[0], thisArg as Collection<string, GuildBasedChannel>);
                }
            }
        },
    };

    private membersCache: Partial<Collection<string, GuildMember>> = {
        constructor: undefined,
        get: (key: string) => {
            if((!!this.members) && (!!this.members.find)) {
                return (this.members.find((guildMember) => guildMember.user?.id === key) as GuildMember);
            }
            return undefined;
        },
        has: (key: string) => {
            if((!!this.members) && (!!this.members.find)) {
                return !!(this.members.find((guildMember) => guildMember.user?.id === key) as GuildMember);
            }
            return false;
        },
        at: (index: number) => {
            if((!!this.members) && (!!this.members.at)) {
                return (this.members.at(index) as GuildMember)
            }
            return undefined;
        },
        size: this.members?.size ?? 0,
        forEach: (callbackFn, thisArg) => {
            const entries = (thisArg as Collection<string, GuildMember>).entries();
            for(const entry of entries) {
                callbackFn(entry[1], entry[0], thisArg as Collection<string, GuildMember>);
            }
        },
    };
    
    private rolesCache: Partial<Collection<string, Role>> = {
        constructor: undefined,
        get: (key: string) => {
            return (this.roles.find((role) => role.id === key) as Role);
        },
        has: (key: string) => {
            return !!(this.roles.find((role) => role.id === key) as Role);
        },
    };

    
    private channelManager: Partial<GuildChannelManager> = {
        fetch: jest.fn().mockImplementation(async () => {
            const channels = new Map<string, NonThreadGuildBasedChannel>();
            if((!!this.channels) && (!!this.channels.map)) {
                await Promise.all(this.channels.map((guildChannel) => {
                    if(!guildChannel.id) return
                    channels.set(guildChannel.id, guildChannel as NonThreadGuildBasedChannel);
                })); 
                return Promise.resolve(channels as Collection<string, NonThreadGuildBasedChannel>);   
            }
            return new Collection<string, NonThreadGuildBasedChannel>();
        }),
        cache: (this.channelsCache as Collection<string, GuildBasedChannel>),
        valueOf: () => (this.channelsCache as Collection<string, GuildBasedChannel>)
    };

    private memberManager: Partial<GuildMemberManager> = {
        fetch: jest.fn().mockImplementation(async () => {
            const members = new Map<string, GuildMember>();
            if((!!this.members) && (!!this.members.map)) {
                await Promise.all(this.members.map((guildMember) => {
                    if(!guildMember.id) return
                    members.set(guildMember.id, guildMember as GuildMember);
                }));
                return Promise.resolve(members as Collection<string, GuildMember>)
            }
            return new Collection<string, GuildMember>();
        }),
        cache: (this.membersCache as Collection<string, GuildMember>),
        valueOf: () => (this.membersCache as Collection<string, GuildMember>),
    };

    private roleManager: Partial<RoleManager> = {
        fetch: jest.fn().mockImplementation(async () => {
            const roles = new Map<string,Role>();
            await Promise.all(this.roles.map((role) => {
                if(!role.id) return
                roles.set(role.id, role as Role);
            }));
            return Promise.resolve(roles as Collection<string,Role>)
        }),
        cache: (this.rolesCache as Collection<string, Role>),
        valueOf: () => (this.rolesCache as Collection<string, Role>)
    };
    
    public guild: Partial<Guild> = {
        members: (this.memberManager as GuildMemberManager),
        channels: (this.channelManager as GuildChannelManager),
        roles: (this.roleManager as RoleManager),
        valueOf: () => this.uid,
    };

    public addMember = async (user: Partial<User>, roleIds: string[]): Promise<GuildMember> => {
        const roleCollection = new Collection<string, Role>();
        await Promise.all(roleIds.map((roleId) => {
            const role = this.guild.roles?.cache.get(roleId);
            if(!role) throw new Error(`Could not find role with id ${roleId}`);
            roleCollection.set(roleId, (role as Role));
        }));
        const userId = user.id;
        if(!userId) throw new Error("No user id");
        const guildMember = await this.guild.members?.add(user as User, {accessToken: userId, roles: roleCollection});
        if(!guildMember) throw new Error("Could not create guild member")
        return guildMember;
    };
};


// Guild id schema:
// 0: main guild
// 1-999: network guilds
// 1000-1099: utility guilds
//      1000-1004: emoji guilds
// 1100+: outside network guilds
export const networkGuilds: GuildGenerator[] = [];
export const notNetworkGuilds: GuildGenerator[] = [];
const networkGuildNum = 1;
const notNetworkGuildNum = 1100;
for(let i = 0; i < networkGuildNum; i++) {
    const networkGuild = new GuildGenerator(new Collection<string, GuildBasedChannel>, [], new Collection<string, GuildMember>, String(i+1));
    networkGuilds.push(networkGuild);
};
for(let i = 1100; i < notNetworkGuildNum; i++) {
    const networkGuild = new GuildGenerator(new Collection<string, GuildBasedChannel>, [], new Collection<string, GuildMember>, String(i+1));
    notNetworkGuilds.push(networkGuild);
};

async (): Promise<void> => {
    await networkGuilds[0].addMember(genUser.user, []);
};

export const aeonGuild = new GuildGenerator(aeonChannels, aeonRoles, new Collection<string, GuildMember>, config.mainServerId);
networkGuilds.push(aeonGuild);


// Permission presets
export const onlyLocal: PermissionLocal = {
    local: true,
    onlyLocal: true
};
export const notOnlyLocal: PermissionLocal = {
    local: true,
    onlyLocal: false
};
export const onlyGlobal: PermissionLocal = {
    local: false,
    onlyLocal: false
};


// Mock client generator
class ClientGenerator {
    protected id: string;
    protected guilds: Partial<Guild>[]
    constructor(id: string, guilds: Partial<Guild>[]) {
        this.id = id
        this.guilds = guilds
        this.clientUser.id = id
        this.clientChannelsSet()
        this.clientChannelCacheSet()
    };

    private clientUser: Partial<ClientUser> = {
        verified: true,
        equals(user: User) { return user.id === this.id; },
        toString() { return `<@${this.id}>`; },
        valueOf: () => `<@${this.id}>`
    };

    private clientGuildCache: Partial<Collection<string, Guild>> = {
        constructor: undefined,
        get: (key: string) => {
            return (this.guilds.find((guild) => guild.id === key) as Guild);
        }
    };

    private clientGuildManager: Partial<GuildManager> = {
        cache: (this.clientGuildCache as Collection<string, Guild>),
        valueOf: () => (this.clientGuildCache as Collection<string, Guild>),
    };

    private clientChannels: Channel[] = [];
    private clientChannelsSet = (): void => {
        this.guilds.forEach((guild) => {
            if(!guild.channels) return;
            guild.channels.cache.forEach((channel) => {
                this.clientChannels.push(channel);
            })
        })
        return 
    };

    private clientChannelCache: Map<string, Channel> = new Map<string, Channel>();
    private clientChannelCacheSet = (): void => {
        this.clientChannels.forEach((channel) => {
            this.clientChannelCache.set(channel.id, channel);
        })
    };
    
    private clientChannelManager: Partial<ChannelManager> = {
        cache: (this.clientChannelCache as Collection<string, Channel>),
        valueOf: () => (this.clientChannelCache as Collection<string, Channel>)
    }

    public mockClient: Partial<ExtendedClient> = {
        guilds: (this.clientGuildManager as GuildManager),
        channels: (this.clientChannelManager as ChannelManager),
        user: (this.clientUser as ClientUser),
    };
}

export const {mockClient} = new ClientGenerator("0", [aeonGuild.guild, ...networkGuilds.map((guild) => guild.guild)]);