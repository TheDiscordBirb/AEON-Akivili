import { Guild, PermissionResolvable, User } from "discord.js";
import { PermissionLocal, PermissionResult } from "../structures/types";
import { PermissionLevels } from "../types/permission-handler";
import { isStaff } from "../utils/permissions";
import { config, unitTest } from "../const";
import { client, ExtendedClient } from "../structures/client";
import { mockClient } from "../tests/mocks";

class PermissionHandler {
    public async checkForPermission(user: User, local: PermissionLocal, guild: Guild, permissionFlags: PermissionResolvable[], permissionLevel?: PermissionLevels): Promise<PermissionResult> {
        if(config.suspendedPermissionUserIds.includes(user.id)) {
            return {status: false, message: "Your permissions are currently suspended."};
        }

        const guildUser = guild.members.cache.get(user.id);
        if(local.local) {
            if(guildUser) {
                const permissionChecks = await Promise.all(permissionFlags.map((permissionFlag) => {
                    if(!guildUser.permissions.has(permissionFlag)) {
                        return {status: false};
                    }
                    return {status: true};
                }));
                if(local.onlyLocal) {
                    if(permissionChecks.find((permissionCheck) => permissionCheck.status == false) || permissionChecks.length == 0) {
                        return {status: false, message: "You do not have permission to use this."};
                    } else {
                        return {status: true};
                    }
                }
                if(permissionChecks.find((permissionCheck) => permissionCheck.status == false)) {
                    return {status: true}
                }
            }
        }

        switch(permissionLevel) {
            case PermissionLevels.REPRESENTATIVE: {
                if(isStaff.rep(user)) {
                    return {status: true};
                }
            }
            case PermissionLevels.NAVIGATOR: {
                if(isStaff.navigator(user)) {
                    return {status: true};
                }
            }
            case PermissionLevels.CONDUCTOR: {
                if(isStaff.conductor(user)) {
                    return {status: true};
                }
            }
            case PermissionLevels.DEV: {
                if(isStaff.dev(user)) {
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