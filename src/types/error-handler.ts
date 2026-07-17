import { User } from "discord.js";

export interface ErrorData {
    error: Error,
    user: User,
    interactionType: InteractionTypes
}

export enum InteractionTypes {
    ADD_TO_SERVERS_EMBED = "add-to-servers-embed",
    BAN = "ban",
    BANSHARE_LIST = "banshare-list",
    CATCAKE_TRADING = "catcake-trading",
    CROWD_CONTROL = "crowd-control",
    DELETE_MESSAGE = "delete-message",
    DISCONNECT = "disconnect",
    EDIT_MESSAGE = "edit-message",
    GET_UID = "get-uid",
    JOIN_NETWORK = "join-network",
    LIST_NETWORK_SERVERS = "list-network-servers",
    MANAGE_NETWORK_MUTE = "manage-network-mute",
    MODMAIL_RESPONSE = "modmail-response",
    REMOVE_FROM_SERVERS_EMBED = "remove-from-servers-embed",
    REMOVE_PREMISSION = "remove-permission",
    REMOVE_REACTION = "remove-reaction",
    REMOVE_SERVER = "remove-server",
    REQUEST_BANSHARE = "request-banshare",
    SET_AUTO_BAN_LEVEL = "set-auto-ban-level",
    SET_IMPORTANT_BANSHARE_ROLE = "set-important-banshare-role",
    BUTTONS = "buttons",
    INTERACTION_READY = "interaction-ready",
    MESSAGE_CREATED = "message-created",
    MESSAGE_DELETED = "message-deleted",
    PIN_UPDATED = "pin-updated",
    REACTION_CREATED = "reaction-created",
    READY = "ready",
    SERVER_JOIN = "server-join",
    UNBAN = "unban"
}

export const ErrorNames = {
    DID_NOT_FIND_WEBHOOK: "Could not find webhook.",
    DID_NOT_FIND_WEBHOOK_IN_CACHE: "Could not find webhook in cached webhooks.",
    DID_NOT_SEND_MESSAGE: "Did not send message.",
    MESSAGE_DOES_NOT_EXIST: "Message does not exist.",
    NO_BROADCAST_IN_DB: "Could not get broadcast in db for server.",
    NO_CHANNEL: "Could not get channel.",
    NO_CHANNEL_TYPE: "Could not get channel type.",
    NO_CLIENT_IN_SERVER: "Could not get bot client for server.",
    NO_GUILD: "Could not get server.",
    NO_GUILD_MEMBER: "Could not get guild user for user.",
    NO_INTERACTION_CHANNEL: "Could not get interaction channel.",
    NO_INVITE: "Could not get invite for a guild.",
    NO_LEAVING_GUILD: "Could not get leaving server.",
    NO_MAIN_GUILD_CLIENT: "Could not find client in main server.",
    NO_MESSAGE_ID: "Could not get message id.",
    NO_MESSAGE: "Could not get message.",
    NO_PERMISSIONS: "No permissions.",
    NO_REQUIRED_FIELD: "You did not fill in a required field, how did you do that?",
    NO_USER: "Could not get user.",
    NO_WEBHOOKS_IN_GUILD: "Could not get any webhooks for this server.",
    USER_IS_MUTED: "User is muted.",
    WRONG_CHANNEL_TYPE: "Wrong channel type.",
} as const;