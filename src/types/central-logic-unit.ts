export interface Data {
    type: DataType,
}


export enum DataType {
    COMMAND = "command",
    EVENT = "event",
}

export interface ValidatedCommandData {
    type: CommandTypes
}

export interface ValidatedEventData {
    type: EventTypes
}

export enum CommandTypes {
    BAN = "ban",
    BANSHARE_LIST = "banshare-list",
    DISCONNECT = "disconnect",
    JOIN_NETWORK = "join-network",
    LIST_NETWORK_SERVERS = "list-network-servers",
    MANAGE_NETWORK_MUTE = "manage-network-mute",
    REMOVE_REACTION = "remove-reaction",
    REQUEST_BANSHARE = "request-banshare",
    SET_AUTO_BAN_LEVEL = "set-auto-ban-level",
    SET_IMPORTANT_BANSHARE_ROLE = "set-important-banshare-role",
    ADD_TO_SERVERS_EMBED = "add-to-servers-embed",
    CROWD_CONTROL = "crowd-control",
    MODMAIL_RESPONSE = "modmail-response",
    REMOVE_FROM_SERVERS_EMBED = "remove-from-servers-embed",
    REMOVE_SERVER = "remove-server",
    DELETE_MESSAGE = "delete-message",
    EDIT_MESSAGE = "edit-message",
    GET_UID = "get-uid",
    REMOVE_PREMISSION = "remove-permission"
}

export enum EventTypes {
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