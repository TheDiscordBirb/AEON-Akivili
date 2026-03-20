import { Guild, User } from "discord.js"
import { permissionHandler } from "../functions/permission-handler"
import { config } from "../const";
import { 
    conductorUser,
    genUser,
    genUserPermissions,
    guild,
    modUser,
    modUserPermissions,
    navigatorUser,
    notLocal,
    notOnlyLocal,
    onlyLocal
} from "./mocks";
import { PermissionLevels } from "../types/permission-handler";

export let expected: boolean = true;
test("Permission handler", async () => {
    // Local moderator check, has permission
    expect(
        await permissionHandler.checkForPermission((modUser as User), onlyLocal, (guild as Guild), ["KickMembers"])
    ).toStrictEqual({status: true});

    // Local moderator check, doesnt have permission
    expect(
        await permissionHandler.checkForPermission((genUser as User), onlyLocal, (guild as Guild), ["KickMembers"])
    ).toStrictEqual({status: false, message: "You do not have permission to use this."});

    // Local (no perms), has sufficient global permission
    expect(
        await permissionHandler.checkForPermission((conductorUser as User), notOnlyLocal, (guild as Guild), [], PermissionLevels.CONDUCTOR)
    ).toStrictEqual({status: true});
    
    // Local (no perms), doesnt have sufficient global permission
    expect(
        await permissionHandler.checkForPermission((navigatorUser as User), notOnlyLocal, (guild as Guild), [], PermissionLevels.CONDUCTOR)
    ).toStrictEqual({status: false, message: "You do not have permission to use this."});

    // Local (no perms), has higher global permissions then required
    expect(
        await permissionHandler.checkForPermission((conductorUser as User), notOnlyLocal, (guild as Guild), [], PermissionLevels.NAVIGATOR)
    ).toStrictEqual({status: true});

    // Not local, only has local perms
    expect(
        await permissionHandler.checkForPermission((modUser as User), notLocal, (guild as Guild), [], PermissionLevels.REPRESENTATIVE)
    ).toStrictEqual({status: false, message: "You do not have permission to use this."});

    // Not local, has sufficient perms
    expect(
        await permissionHandler.checkForPermission((conductorUser as User), notLocal, (guild as Guild), [], PermissionLevels.CONDUCTOR)
    ).toStrictEqual({status: true});

    // Suspended staff
    config.suspendedPermissionUserIds.push((conductorUser as User).id);
    expect(
        await permissionHandler.checkForPermission((conductorUser as User), notOnlyLocal, (guild as Guild), [], PermissionLevels.NAVIGATOR)
    ).toStrictEqual({status: false, message: "Your permissions are currently suspended."});
});