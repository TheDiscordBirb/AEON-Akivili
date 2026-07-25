export interface PermissionLocal {
    local: boolean,
    onlyLocal: boolean
}

export interface PermissionResult {
    status: boolean,
    message?: string
}
export enum PermissionLevels {
    DEV = 0,
    CONDUCTOR = 1,
    NAVIGATOR = 2,
    REPRESENTATIVE = 3,
}