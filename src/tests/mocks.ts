import {
    Collection,
    Guild,
    GuildMember,
    GuildMemberManager,
    PermissionResolvable,
    PermissionsBitField,
    User
} from "discord.js"
import { PermissionLocal } from "../structures/types";

export let hasTrue = true;
export let guildMemberExists = true;
export const user: Partial<User> = {
    equals: () => true,
    toString() {
        return `<@1>`
    },
    valueOf: () => "1",
    id: "1"
};
export const permissions: PermissionResolvable[] = [
    "KickMembers"
];
export const userPermissions: PermissionResolvable[] = ["KickMembers"];
export const permissionsBitField: Partial<PermissionsBitField> = {
    has(permission) {
        return (userPermissions.includes(permission))
    },
    valueOf: () => BigInt(1)
}
export const guildMember: Partial<GuildMember> = {
    user: (user as User),
    toString() {
        return `<@1>`
    },
    valueOf: () => "1",
    permissions: (permissionsBitField as PermissionsBitField)
};
export const mapIteratorValues: Partial<MapIterator<GuildMember>> = [(guildMember as GuildMember)];
export const mapIteratorKeys: Partial<MapIterator<string>> = ["1"];
export const collection: Partial<Collection<string, GuildMember>> = {
    constructor: undefined,
    get() {
        return guildMemberExists ? (guildMember as GuildMember) : undefined 
    },
    keys: () => (mapIteratorKeys as MapIterator<string>),
    values: () => (mapIteratorValues as MapIterator<GuildMember>),
    has() {
        return hasTrue
    },

};
export const guildMemberManager: Partial<GuildMemberManager> = {
    cache: (collection as Collection<string, GuildMember>),
    valueOf: () => (collection as Collection<string, GuildMember>),
};
export const guild: Partial<Guild> = {
    members: (guildMemberManager as GuildMemberManager),
    valueOf: () => "1"
};
export const onlyLocal: PermissionLocal = {
    local: true,
    onlyLocal: true
};
export const notOnlyLocal: PermissionLocal = {
    local: true,
    onlyLocal: false
};