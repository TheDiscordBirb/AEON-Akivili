import { getEnvVar } from "./utils"

export const config = {
    aeonBanshareChannelId: getEnvVar<string>("AEON_BANSHARE_CHANNEL_ID"),
    approvalCountNeededForBlanketBan: 2,
    maxConcurrentRequestCount: 10,
    networkJoinChannelId: getEnvVar<string>("NETWORK_JOIN_CHANNEL_ID"),
    nonChatWebhooks: getEnvVar<string>("NON_CHAT_WEBHOOKS").split(','),
    deleteLogsOnStartup: true,
}
