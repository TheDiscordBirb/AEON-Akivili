import { getEnvVar } from "./utils"

export const config = {
    aeonBanshareChannelId: getEnvVar<string>("AEON_BANSHARE_CHANNEL_ID"),
    approvalCountNeededForBlanketBan: 2,
    maxConcurrentRequestCount: 10,
    networkJoinChannelId: getEnvVar<string>("NETWORK_JOIN_CHANNEL_ID"),
    nonChatWebhooks: getEnvVar<string>("NON_CHAT_WEBHOOKS").split(','),
    deleteLogsOnStartup: true,
    numberOfMessagesToLoad: 100,
    replyPictureEmojiId: getEnvVar<string>("REPLY_PICTURE_EMOJI_ID"),
    replyArrowEmojiId: getEnvVar<string>("REPLY_ARROW_EMOJI_ID"),
}
