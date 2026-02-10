import { Guild, PermissionResolvable, User } from "discord.js";
import { PermissionLocal, PermissionResult } from "../structures/types";
import { PermissionLevels } from "../types/permission-handler";
import { isConductor, isDev, isNavigator, isRep } from "../utils/permissions"
import { config } from "../const";

class PermissionHandler {
    public async checkForPermission(user: User, local: PermissionLocal, guild: Guild, permissionFlags: PermissionResolvable[], permissionLevel?: PermissionLevels): Promise<PermissionResult> {
        if(config.suspendedPermissionUserIds.includes(user.id)) {
            return {status: false, message: "Your permissions are currently suspended."};
        }

        const guildUser = guild.members.cache.get(user.id);
        if(local.local) {
            if(guildUser) {
                await Promise.all(permissionFlags.map((permissionFlag) => {
                    if(!guildUser.permissions.has(permissionFlag)) {
                        return "You do not have permission to use this.";
                    }
                }))
                return {status: true};
            }
            if(local.onlyLocal) {
                return {status: false, message: "You do not have permission to use this."};
            }
        }

        switch(permissionLevel) {
            case PermissionLevels.REPRESENTATIVE: {
                if(isRep(user)) {
                    return {status: true};
                }
            }
            case PermissionLevels.NAVIGATOR: {
                if(isNavigator(user)) {
                    return {status: true};
                }
            }
            case PermissionLevels.CONDUCTOR: {
                if(isConductor(user)) {
                    return {status: true};
                }
            }
            case PermissionLevels.DEV: {
                if(isDev(user)) {
                    return {status: true};
                } else {
                    return {status: false, message: "You do not have permission to use this."};
                }
            }
            default: {
                return {status: false, message: "You do not have permission to use this."};
            }
        }
    }
}

export const permissionHandler = new PermissionHandler();