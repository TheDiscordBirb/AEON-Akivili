export interface Data {
    type: DataType,
    data: CommandData | EventData
}

export enum DataType {
    COMMAND = "command",
    EVENT = "event",
}

export interface ValidatedCommandData {
    data: CommandData
}

export type CommandData = AddToServersEmbedData |
    BanData |
    BanshareListData |
    CatcakeTradingData |
    CrowdControlData |
    DeleteMessageData |
    DisconnectData |
    EditMessageData |
    GetUidData |
    JoinNetworkData |
    ListNetworkServersData |
    ManageNetworkMuteData |
    ModmailResponseData |
    RemoveFromServersEmbed |
    RemoveReactionData |
    RemoveServerData |
    RequestBanshareData |
    SetAutoBanLevelData |
    SetImportantBanshareRoleData;

export interface AddToServersEmbedData {
    type: CommandTypes.ADD_TO_SERVERS_EMBED
}
export interface BanData {
    type: CommandTypes.BAN
}
export interface BanshareListData {
    type: CommandTypes.BANSHARE_LIST
}
export interface CatcakeTradingData {
    type: CommandTypes.CATCAKE_TRADING
}
export interface CrowdControlData {
    type: CommandTypes.CROWD_CONTROL
}
export interface DeleteMessageData {
    type: CommandTypes.DELETE_MESSAGE
}
export interface DisconnectData {
    type: CommandTypes.DISCONNECT
}
export interface EditMessageData {
    type: CommandTypes.EDIT_MESSAGE
}
export interface GetUidData {
    type: CommandTypes.GET_UID
}
export interface JoinNetworkData {
    type: CommandTypes.JOIN_NETWORK
}
export interface ListNetworkServersData {
    type: CommandTypes.LIST_NETWORK_SERVERS
}
export interface ManageNetworkMuteData {
    type: CommandTypes.MANAGE_NETWORK_MUTE
}
export interface ModmailResponseData {
    type: CommandTypes.MODMAIL_RESPONSE
}
export interface RemoveFromServersEmbed {
    type: CommandTypes.REMOVE_FROM_SERVERS_EMBED
}
export interface RemoveReactionData {
    type: CommandTypes.REMOVE_REACTION
}
export interface RemoveServerData {
    type: CommandTypes.REMOVE_SERVER
}
export interface RequestBanshareData {
    type: CommandTypes.REQUEST_BANSHARE
}
export interface SetAutoBanLevelData {
    type: CommandTypes.SET_AUTO_BAN_LEVEL
}
export interface SetImportantBanshareRoleData {
    type: CommandTypes.SET_IMPORTANT_BANSHARE_ROLE
}

export interface ValidatedEventData {
    data: EventData
}

export type EventData = ButtonData |
    InteractionReadyData |
    MessageCreatedData |
    MessageDeletedData |
    PinUpdatedData |
    ReactionCreatedData |
    ReadyData |
    ServerJoinData |
    UnbanData

export interface ButtonData {
    type: EventTypes.BUTTONS
}
export interface InteractionReadyData {
    type: EventTypes.INTERACTION_READY
}
export interface MessageCreatedData {
    type: EventTypes.MESSAGE_CREATED
}
export interface MessageDeletedData {
    type: EventTypes.MESSAGE_DELETED
}
export interface PinUpdatedData {
    type: EventTypes.PIN_UPDATED
}
export interface ReactionCreatedData {
    type: EventTypes.REACTION_CREATED
}
export interface ReadyData {
    type: EventTypes.READY
}
export interface ServerJoinData {
    type: EventTypes.SERVER_JOIN
}
export interface UnbanData {
    type: EventTypes.UNBAN
}

export enum CommandTypes {
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