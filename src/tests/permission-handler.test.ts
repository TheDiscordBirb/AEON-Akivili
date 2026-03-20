import { Guild, User } from "discord.js"
import { permissionHandler } from "../functions/permission-handler"
import { config } from "../const";
import { 
    conductorUser,
    genUser,
    guild,
    modUser,
    navigatorUser,
    onlyGlobal,
    notOnlyLocal,
    onlyLocal
} from "./mocks";
import { PermissionLevels } from "../types/permission-handler";

test("Local moderator check, has permission", async () => {
    expect(
        await permissionHandler.checkForPermission((modUser as User), onlyLocal, (guild as Guild), ["KickMembers"])
    ).toStrictEqual({status: true});
});
test("Local moderator check, doesnt have permission", async () => {
    expect(
        await permissionHandler.checkForPermission((genUser as User), onlyLocal, (guild as Guild), ["KickMembers"])
    ).toStrictEqual({status: false, message: "You do not have permission to use this."});
});
test("Local moderator check, doesnt have permission, has global perms", async () => {
    expect(
        await permissionHandler.checkForPermission((conductorUser as User), onlyLocal, (guild as Guild), ["KickMembers"])
    ).toStrictEqual({status: false, message: "You do not have permission to use this."});
});

test("Local (no perms), has sufficient global permission", async () => {
    expect(
        await permissionHandler.checkForPermission((conductorUser as User), notOnlyLocal, (guild as Guild), [], PermissionLevels.CONDUCTOR)
    ).toStrictEqual({status: true});
});
test("Local (no perms), doesnt have sufficient global permission", async () => {
    expect(
        await permissionHandler.checkForPermission((navigatorUser as User), notOnlyLocal, (guild as Guild), [], PermissionLevels.CONDUCTOR)
    ).toStrictEqual({status: false, message: "You do not have permission to use this."});
});
test("Local (no perms), has higher global permissions then required", async () => {
    expect(
        await permissionHandler.checkForPermission((conductorUser as User), notOnlyLocal, (guild as Guild), [], PermissionLevels.NAVIGATOR)
    ).toStrictEqual({status: true});
});

test("Not local, only has local perms", async () => {
    expect(
        await permissionHandler.checkForPermission((modUser as User), onlyGlobal, (guild as Guild), [], PermissionLevels.REPRESENTATIVE)
    ).toStrictEqual({status: false, message: "You do not have permission to use this."});
});
test("Not local, has sufficient perms", async () => {
    expect(
        await permissionHandler.checkForPermission((conductorUser as User), onlyGlobal, (guild as Guild), [], PermissionLevels.CONDUCTOR)
    ).toStrictEqual({status: true});
});

test("Suspended global", async () => {
    config.suspendedPermissionUserIds.push((conductorUser as User).id);
    expect(
        await permissionHandler.checkForPermission((conductorUser as User), notOnlyLocal, (guild as Guild), [], PermissionLevels.NAVIGATOR)
    ).toStrictEqual({status: false, message: "Your permissions are currently suspended."});
});
test("Suspended local", async () => {
    config.suspendedPermissionUserIds.push((modUser as User).id);
    expect(
        await permissionHandler.checkForPermission((modUser as User), onlyLocal, (guild as Guild), ["KickMembers"])
    ).toStrictEqual({status: false, message: "Your permissions are currently suspended."});
});