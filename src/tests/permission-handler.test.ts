import { Client, Guild, User } from "discord.js"
import { PermissionHandler } from "../functions/permission-handler"
import { config } from "../const";
import { 
    conductorUser,
    genUser,
    networkGuilds,
    modUser,
    navigatorUser,
    onlyGlobal,
    notOnlyLocal,
    onlyLocal,
    fillUp
} from "./mocks";
import { PermissionLevels } from "../types/permission-handler";
import { IsStaff } from "../utils/permissions";
import { mockClient } from "../tests/mocks";
import { ExtendedClient } from "../structures/client";

const isStaff = new IsStaff(mockClient as ExtendedClient);
const permissionHandler = new PermissionHandler(isStaff)

test("Local moderator check, has permission", async () => {
await fillUp();
    expect(
        await permissionHandler.checkForPermission((modUser.user as User), onlyLocal, (networkGuilds[0].guild as Guild), ["KickMembers"])
    ).toStrictEqual({status: true});
});
test("Local moderator check, doesnt have permission", async () => {
    expect(
        await permissionHandler.checkForPermission((genUser.user as User), onlyLocal, (networkGuilds[0].guild as Guild), ["KickMembers"])
    ).toStrictEqual({status: false, message: "You do not have permission to use this." });
});
test("Local moderator check, doesnt have permission, has global perms", async () => {
    expect(
        await permissionHandler.checkForPermission((conductorUser.user as User), onlyLocal, (networkGuilds[0].guild as Guild), ["KickMembers"])
    ).toStrictEqual({status: false, message: "You do not have permission to use this." });
});

test("Local (no perms), has sufficient global permission", async () => {
    expect(
        await permissionHandler.checkForPermission((conductorUser.user as User), notOnlyLocal, (networkGuilds[0].guild as Guild), [], PermissionLevels.CONDUCTOR)
    ).toStrictEqual({status: true});
});
test("Local (no perms), doesnt have sufficient global permission", async () => {
    expect(
        await permissionHandler.checkForPermission((navigatorUser.user as User), notOnlyLocal, (networkGuilds[0].guild as Guild), [], PermissionLevels.CONDUCTOR)
    ).toStrictEqual({status: false, message: "You do not have permission to use this." });
});
test("Local (no perms), has higher global permissions then required", async () => {
    expect(
        await permissionHandler.checkForPermission((conductorUser.user as User), notOnlyLocal, (networkGuilds[0].guild as Guild), [], PermissionLevels.NAVIGATOR)
    ).toStrictEqual({status: true});
});

test("Not local, only has local perms", async () => {
    expect(
        await permissionHandler.checkForPermission((modUser.user as User), onlyGlobal, (networkGuilds[0].guild as Guild), [], PermissionLevels.REPRESENTATIVE)
    ).toStrictEqual({status: false, message: "You do not have permission to use this." });
});
test("Not local, has sufficient perms", async () => {
    expect(
        await permissionHandler.checkForPermission((conductorUser.user as User), onlyGlobal, (networkGuilds[0].guild as Guild), [], PermissionLevels.CONDUCTOR)
    ).toStrictEqual({status: true});
});

test("Suspended global", async () => {
    config.suspendedPermissionUserIds.push((conductorUser.user as User).id);
    expect(
        await permissionHandler.checkForPermission((conductorUser.user as User), notOnlyLocal, (networkGuilds[0].guild as Guild), [], PermissionLevels.NAVIGATOR)
    ).toStrictEqual({status: false, message: "Your permissions are currently suspended." });
});
test("Suspended local", async () => {
    config.suspendedPermissionUserIds.push((modUser.user as User).id);
    expect(
        await permissionHandler.checkForPermission((modUser.user as User), onlyLocal, (networkGuilds[0].guild as Guild), ["KickMembers"])
    ).toStrictEqual({status: false, message: "Your permissions are currently suspended." });
});