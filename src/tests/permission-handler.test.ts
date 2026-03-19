import { Guild, User } from "discord.js"
import { permissionHandler } from "../functions/permission-handler"
import { config } from "../const";
import { 
    guild,
    notOnlyLocal,
    onlyLocal,
    permissions,
    user,
    userPermissions
} from "./mocks";

export let expected: boolean = true;
test("Permission handler", async () => {
    // Local moderator check, has permission
    expect(
        await permissionHandler.checkForPermission((user as User), onlyLocal, (guild as Guild), permissions)
    ).toStrictEqual({status: true});

    // Local moderator check, doesnt have permission
    userPermissions.length = 0;
    expect(
        await permissionHandler.checkForPermission((user as User), onlyLocal, (guild as Guild), permissions)
    ).toStrictEqual({status: false, message: "You do not have permission to use this."});

    // Local (no perms), expected true on other check
    expect(
        await permissionHandler.checkForPermission((user as User), notOnlyLocal, (guild as Guild), permissions)
    ).toStrictEqual({status: true});

    // Suspended staff
    config.suspendedPermissionUserIds.push(user.id ?? "1");
    expect(
        await permissionHandler.checkForPermission((user as User), notOnlyLocal, (guild as Guild), permissions)
    ).toStrictEqual({status: false, message: "Your permissions are currently suspended."});
});