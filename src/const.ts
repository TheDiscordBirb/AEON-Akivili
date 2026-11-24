import { Webhook } from "discord.js"
import { getEnvVar } from "./utils/get-env-var"
import { mockConfig } from "./unit-test-config";
import { configType } from "./types/config";

export const unitTest = false;
export let config: configType;
if(!unitTest) {
    config = {
        cachedInteractions: [],
        activeBanshareFuncionUserIds: [],
        activeWebhooks: [],
        aeonBanshareChannelId: getEnvVar<string>("AEON_BANSHARE_CHANNEL_ID"),
        approvalCountNeededForImportantBanshare: 2,
        birbId: getEnvVar<string>("BIRB_ID"),
        botStarting: false,
        cachedEmojiUids: [],
        cleanDbMode: false,
        clientName: "Akivili",
        conductorRoleId: getEnvVar<string>("CONDUCTOR_ROLE_ID"),
        crowdControlActive: false,
        crowdControlChannelId: getEnvVar<string>("CROWD_CONTROL_CHANNEL_ID"),
        currentLogFileName: '',
        databaseHost: getEnvVar<string>("DATABASE_HOST"),  
        databaseName: getEnvVar<string>("DATABASE_NAME"), 
        databasePassword: getEnvVar<string>("DATABASE_PASSWORD"), 
        databasePort: getEnvVar<number>("DATABASE_PORT"),  
        databaseUsername: getEnvVar<string>("DATABASE_USERNAME"),  
        debugMode: true,
        devIds: getEnvVar<string>("DEV_IDS").split(' '),
        /* 
            disabledStickerNetworkServerIds is depricated
            use DatabaseManager.getAllServerStickerStatus();
        */
        disabledStickerNetworkServerIds: ["1068066545344970783"] as string[],
        embedFieldLimit: 25,
        enableStickers: true,
        infoMessageChannelId: getEnvVar<string>("INFO_MESSAGE_CHANNEL_ID"),
        loadedClients: 0,
        mainServerId: getEnvVar<string>("MAIN_SERVER_ID"),
        maxConcurrentRequestCount: 10,
        maxEmbedColumnValueLength: 1024,
        maxEmojiPerServer: 50,
        maxServerPerClient: 50,
        modmailCategoryChannelId: getEnvVar<string>("MODMAIL_CATEGORY_CHANNEL_ID"),
        modmailLogChannelId: getEnvVar<string>("MODMAIL_LOG_CHANNEL_ID"),
        navigatorRoleId: getEnvVar<string>("NAVIGATOR_ROLE_ID"),
        networkJoinChannelId: getEnvVar<string>("NETWORK_JOIN_CHANNEL_ID"),
        nonChatWebhooks: getEnvVar<string>("NON_CHAT_WEBHOOKS").split(','),
        nonChatWebhooksTypes: getEnvVar<string>("NON_CHAT_WEBHOOK_TYPES").split(' '),
        numberOfDaysLogsAreDeletedAfter: 7,
        numberOfMessagesToLoad: 100000,
        privateNotificationChannelId: getEnvVar<string>("PRIVATE_NOTIFICATION_CHANNEL_ID"),
        publicNotificationChannelId: getEnvVar<string>("PUBLIC_NOTIFICATION_CHANNEL_ID"),
        replyArrowEmojiName: getEnvVar<string>("REPLY_ARROW_EMOJI_NAME"),
        replyPictureEmojiName: getEnvVar<string>("REPLY_PICTURE_EMOJI_NAME"),
        representativeRoleId: getEnvVar<string>("REPRESENTATIVE_ROLE_ID"),
        suspendedPermissionUserIds: [] as string[],
        tempBanshareServerId: getEnvVar<string>("TEMP_BANSHARE_SERVER_ID"),
        tokens: getEnvVar<string>("DISCORD_TOKENS").split(" "),
        latestPrivacyPolicyTime: 0
    }
} else {
    config = mockConfig;
}
