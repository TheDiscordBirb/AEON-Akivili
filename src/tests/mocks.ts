import {
    Channel,
    ChannelManager,
    ChannelType,
    ClientUser,
    Collection,
    Guild,
    GuildBasedChannel,
    GuildChannelManager,
    GuildMember,
    GuildMemberManager,
    GuildMemberRoleManager,
    PermissionResolvable,
    PermissionsBitField,
    Role,
    User
} from "discord.js"
import { PermissionLocal } from "../structures/types";
import { ExtendedClient } from "../structures/client";
import { config } from "../const";

// User mocks
export const genUser: Partial<User> = {
    equals: () => true,
    toString() {
        return `<@1>`
    },
    valueOf: () => `<@1>`,
    id: "1"
};
export const genUserPermissions: PermissionResolvable[] = [];
export const genUserPermissionsBitField: Partial<PermissionsBitField> = {
    has(permission) {
        return genUserPermissions.includes(permission);
    },
    valueOf: () => BigInt(1)
}
export const modUser: Partial<User> = {
    equals: () => true,
    toString() {
        return `<@2>`
    },
    valueOf: () => `<@2>`,
    id: "2"
};
export const modUserPermissions: PermissionResolvable[] = [
    "KickMembers",
    "ManageChannels",
    "BanMembers"
];
export const modUserPermissionsBitField: Partial<PermissionsBitField> = {
    has(permission) {
        return modUserPermissions.includes(permission);
    },
    valueOf: () => BigInt(1)
}
export const repUser: Partial<User> = {
    equals: () => true,
    toString() {
        return `<@3>`
    },
    valueOf: () => `<@3>`,
    id: "3"
};
export const navigatorUser: Partial<User> = {
    equals: () => true,
    toString() {
        return `<@4>`
    },
    valueOf: () => `<@4>`,
    id: "4"
};
export const conductorUser: Partial<User> = {
    equals: () => true,
    toString() {
        return `<@5>`
    },
    valueOf: () => `<@5>`,
    id: "5"
};
export const devUser: Partial<User> = {
    equals: () => true,
    toString() {
        return `<@6>`
    },
    valueOf: () => `<@6>`,
    id: "6"
};

// Network guild member mocks
export const guildMembers: Partial<GuildMember>[] = [{
    user: (genUser as User),
    toString() {
        return `<@${this.user?.id}>`
    },
    valueOf() {
        return this.user?.id ?? "1"
    },
    permissions: (genUserPermissionsBitField as PermissionsBitField),
}, {
    user: (modUser as User),
    toString() {
        return `<@${this.user?.id}>`
    },
    valueOf() {
        return this.user?.id ?? "2"
    },
    permissions: (modUserPermissionsBitField as PermissionsBitField)

}];
export const guildMembersCache: Partial<Collection<string, GuildMember>> = {
    constructor: undefined,
    get(key: string) {
        return (guildMembers.find((guildMember) => guildMember.user?.id === key) as GuildMember);
    },
    has(key: string) {
        return !!(guildMembers.find((guildMember) => guildMember.id === key) as GuildMember);
    },

};

// Network guild mock
export const guildMemberManager: Partial<GuildMemberManager> = {
    cache: (guildMembersCache as Collection<string, GuildMember>),
    valueOf: () => (guildMembersCache as Collection<string, GuildMember>),
};
export const guild: Partial<Guild> = {
    members: (guildMemberManager as GuildMemberManager),
    valueOf: () => "1"
};

// Permission presets
export const onlyLocal: PermissionLocal = {
    local: true,
    onlyLocal: true
};
export const notOnlyLocal: PermissionLocal = {
    local: true,
    onlyLocal: false
};
export const notLocal: PermissionLocal = {
    local: false,
    onlyLocal: false
}

// Aeon general mock

// Channels
export const aeonChannelsCache: Partial<Collection<string, GuildBasedChannel>> = {
    constructor: undefined,
    get(key: string) {
        return (aeonChannels.find((channel) => channel.id === key) as GuildBasedChannel);
    }
};
export const aeonChannelManager: Partial<GuildChannelManager> = {
    cache: (aeonChannelsCache as Collection<string, GuildBasedChannel>),
    valueOf: () => (aeonChannelsCache as Collection<string, GuildBasedChannel>)
};

// Roles
export const aeonRoles: Partial<Role>[] = [{
    name: "Rep",
    id: config.representativeRoleId,
    toString() {
        return `<@&${this.id}>`
    },
    valueOf() {
        return this.id ?? "3"
    }
}, {
    name: "Navigator",
    id: config.navigatorRoleId,
    toString() {
        return `<@&${this.id}>`
    },
    valueOf() {
        return this.id ?? "2"
    }
},{
    name: "Conductor",
    id: config.conductorRoleId,
    toString() {
        return `<@&${this.id}>`
    },
    valueOf() {
        return this.id ?? "1"
    }
}]
export const genUserRoles: Partial<Role>[] = [];
export const repUserRoles: Partial<Role>[] = [(aeonRoles.find((aeonRole) => aeonRole.id === config.representativeRoleId) as Role)];
export const navigatorUserRoles: Partial<Role>[] = [(aeonRoles.find((aeonRole) => aeonRole.id === config.navigatorRoleId) as Role)];
export const conductorUserRoles: Partial<Role>[] = [(aeonRoles.find((aeonRole) => aeonRole.id === config.conductorRoleId) as Role)];

export const genUserRolesCache: Partial<Collection<string, Role>> = {
    constructor: undefined,
    get(key: string) {
        return (genUserRoles.find((genUserRole) => genUserRole.id === key) as Role);
    },
    has(key: string) {
        return !!(genUserRoles.find((genUserRole) => genUserRole.id === key));
    }
}

export const repUserRolesCache: Partial<Collection<string, Role>> = {
    constructor: undefined,
    get(key: string) {
        return (repUserRoles.find((repUserRole) => repUserRole.id === key) as Role);
    },
    has(key: string) {
        return !!(repUserRoles.find((repUserRole) => repUserRole.id === key));
    }
}
export const navigatorUserRolesCache: Partial<Collection<string, Role>> = {
    constructor: undefined,
    get(key: string) {
        return (navigatorUserRoles.find((navigatorUserRole) => navigatorUserRole.id === key) as Role);
    },
    has(key: string) {
        return !!(navigatorUserRoles.find((navigatorUserRole) => navigatorUserRole.id === key));
    }
}
export const conductorUserRolesCache: Partial<Collection<string, Role>> = {
    constructor: undefined,
    get(key: string) {
        return (conductorUserRoles.find((conductorUserRole) => conductorUserRole.id === key) as Role);
    },
    has(key: string) {
        return !!(conductorUserRoles.find((conductorUserRole) => conductorUserRole.id === key));
    }
}

export const genUserRoleManager: Partial<GuildMemberRoleManager> = {
    cache: (genUserRolesCache as Collection<string, Role>),
    valueOf: () => (genUserRolesCache as Collection<string, Role>)
}
export const repUserRoleManager: Partial<GuildMemberRoleManager> = {
    cache: (repUserRolesCache as Collection<string, Role>),
    valueOf: () => (repUserRolesCache as Collection<string, Role>)
}
export const navigatorUserRoleManager: Partial<GuildMemberRoleManager> = {
    cache: (navigatorUserRolesCache as Collection<string, Role>),
    valueOf: () => (navigatorUserRolesCache as Collection<string, Role>)
}
export const conductorUserRoleManager: Partial<GuildMemberRoleManager> = {
    cache: (conductorUserRolesCache as Collection<string, Role>),
    valueOf: () => (conductorUserRolesCache as Collection<string, Role>)
}

// Members
export const aeonMembers: Partial<GuildMember>[] = [{
    user: (genUser as User),
    toString() {
        return `<@${this.user?.id}>`
    },
    valueOf() {
        return this.user?.id ?? "1"
    },
    roles: (genUserRoleManager as GuildMemberRoleManager)
}, {
    user: (modUser as User),
    toString() {
        return `<@${this.user?.id}>`
    },
    valueOf() {
        return this.user?.id ?? "2"
    },
    roles: (genUserRoleManager as GuildMemberRoleManager)
}, {
    user: (repUser as User),
    toString() {
        return `<@${this.user?.id}>`
    },
    valueOf() {
        return this.user?.id ?? "3"
    },
    roles: (repUserRoleManager as GuildMemberRoleManager)
}, {
    user: (navigatorUser as User),
    toString() {
        return `<@${this.user?.id}>`
    },
    valueOf() {
        return this.user?.id ?? "4"
    },
    roles: (navigatorUserRoleManager as GuildMemberRoleManager)
}, {
    user: (conductorUser as User),
    toString() {
        return `<@${this.user?.id}>`
    },
    valueOf() {
        return this.user?.id ?? "5"
    },
    roles: (conductorUserRoleManager as GuildMemberRoleManager)
}, {
    user: (devUser as User),
    toString() {
        return `<@${this.user?.id}>`
    },
    valueOf() {
        return this.user?.id ?? "6"
    }
}];
export const aeonMembersCache: Partial<Collection<string, GuildMember>> = {
    constructor: undefined,
    get(key: string) {
        return (aeonMembers.find((aeonMember) => aeonMember.user?.id === key) as GuildMember)
    },
    has(key: string) {
        return !!(aeonMembers.find((aeonMember) => aeonMember.user?.id === key) as GuildMember)
    }
}
export const aeonMemberManager: Partial<GuildMemberManager> = {
    cache: (aeonMembersCache as Collection<string, GuildMember>),
    valueOf: () => (aeonMembersCache as Collection<string, GuildMember>)
}

// Guild
export const aeonGuild: Partial<Guild> = {
    id: config.mainServerId,
    valueOf: () => config.mainServerId,
    channels: (aeonChannelManager as GuildChannelManager),
    members: (aeonMemberManager as GuildMemberManager)
};
export const aeonChannels: Partial<GuildBasedChannel>[] = [{
    name: "BanshareChannel",
    type: ChannelType.GuildText,
    id: config.aeonBanshareChannelId,
    toString() {
        return `<#${config.aeonBanshareChannelId}>`
    },
    valueOf: () => `<#${config.aeonBanshareChannelId}>`,
    guild: (aeonGuild as Guild)
}];

// Client mock
export const clientChannels: Partial<Channel>[] = [...aeonChannels];
export const clientChannelCache: Partial<Collection<string, Channel>> = {
    constructor: undefined,
    get(key: string) {
        return (clientChannels.find((channel) => channel.id === key) as Channel);
    }
}
export const clientChannelManager: Partial<ChannelManager> = {
    cache: (clientChannelCache as Collection<string, Channel>),
    valueOf: () => (clientChannelCache as Collection<string, Channel>),
}
export const clientUser: Partial<ClientUser> = {
    verified: true,
    equals(user: User) { return clientUser === user; },
    toString() { return `<@0>`; },
    valueOf: () => `<@0>`,
    id: "0"
}
export const mockClient: Partial<ExtendedClient> = {
    channels: (clientChannelManager as ChannelManager),
    user: (clientUser as ClientUser),
};