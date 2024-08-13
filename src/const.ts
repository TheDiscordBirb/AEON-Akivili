import { getEnvVar } from "./utils"

export const config = {
    aeonBanshareChannelId: getEnvVar<string>("AEON_BANSHARE_CHANNEL_ID"),
    approvalCountNeededForImportantBanshare: 2,
    deleteLogsOnStartup: true,
    maxConcurrentRequestCount: 10,
    networkJoinChannelId: getEnvVar<string>("NETWORK_JOIN_CHANNEL_ID"),
    nonChatWebhooks: getEnvVar<string>("NON_CHAT_WEBHOOKS").split(','),
    notificationChannelId: getEnvVar<string>("NOTIFICATION_CHANNEL_ID"),
    numberOfMessagesToLoad: 100,
    replyPictureEmojiId: getEnvVar<string>("REPLY_PICTURE_EMOJI_ID"),
    replyArrowEmojiId: getEnvVar<string>("REPLY_ARROW_EMOJI_ID"),
    devId: getEnvVar<string>("DEV_ID"),
    infoMessageChannelId: getEnvVar<string>("INFO_MESSAGE_CHANNEL_ID"),
    infoMessageId: getEnvVar<string>("INFO_MESSAGE_ID"),
}
