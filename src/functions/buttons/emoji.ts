import {
    ButtonComponent,
    ButtonInteraction,
    CacheType,
    Client,
    TextChannel,
    BaseGuildTextChannel,
    ActionRow,
    MessageActionRowComponent
} from "discord.js";
import { ChannelType, MessageFlags } from "discord-api-types/v10";
import { config } from "../../const";
import { databaseManager } from "../../structures/database";
import { replaceEmojis, deleteEmojis } from "../../utils/emoji";
import { rebuildMessageComponentAfterUserInteraction } from "../../utils/rebuild-comps";
import { ErrorNames } from "../../types/error-handler";

export const emojiButton = async (client: Client, interaction: ButtonInteraction<CacheType>): Promise<void> => {
    const uniqueMessageId = databaseManager.getMessageUid(interaction.message.id);
    const userId = interaction.user.id;
    const reactionIdentifier = (interaction.component as ButtonComponent).customId;
    if (!reactionIdentifier) throw new Error(ErrorNames.NO_REACTION_IDENTIFIER);

    const channel = interaction.message.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) return;

    const broadcastRecords = await databaseManager.getBroadcasts();

    const webhooks = config.activeWebhooks;
    const guildWebhooks = webhooks.filter((webhook) => webhook.guildId === interaction.guildId);
    if (!guildWebhooks) {
        await interaction.followUp({ content: 'This server is not connected to any Aeon channels.', flags: MessageFlags.Ephemeral });
        return;
    }
    const webhook = guildWebhooks.find((channelWebhook) => channelWebhook.channelId === interaction.channelId);
    if (!webhook) {
        await interaction.followUp({ content: "Couldnt find Aeon webhook, contact Birb to resolve this issue." });
        return;
    }
    const webhookBroadcast = await databaseManager.getBroadcastByWebhookId(webhook.id);
    if (!webhookBroadcast) throw new Error(ErrorNames.NO_BROADCAST_IN_CACHE);
    if (config.nonChatWebhooksTypes.includes(webhookBroadcast.channelType)) return;


    const webhookNameParts = webhook.name.split(' ');
    const webhookChannelType = webhookNameParts[webhookNameParts.length - 1];
    const matchingBroadcastRecords = broadcastRecords.filter((broadcastRecord) => broadcastRecord.channelType === webhookChannelType);
    const newActionRows = await rebuildMessageComponentAfterUserInteraction(
        interaction.message,
        interaction.message.components as ActionRow<MessageActionRowComponent>[],
        { userId, messageUid: uniqueMessageId, reactionIdentifier }
    );
    const emojiReplacement = await replaceEmojis(interaction.message.content, client);


    await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
        const webhook = webhooks.find((webhook) => webhook.id === broadcastRecord.webhookId);
        if (!webhook) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK_IN_CACHE);

        const messagesOnNetwork = await databaseManager.getMessages(interaction.message.id);
        const correctMessageOnNetwork = messagesOnNetwork.find((messageOnNetwork) => messageOnNetwork.channelId === broadcastRecord.channelId);
        if (!correctMessageOnNetwork) throw new Error(ErrorNames.NO_MESSAGE);

        const channel = client.channels.cache.find((ch) => ch.id === correctMessageOnNetwork.channelId) as TextChannel;
        const message = await channel.messages.fetch({ message: correctMessageOnNetwork.messageUid });
        if (!message.components) throw new Error(ErrorNames.NO_MESSAGE_COMPONENTS);

        await webhook.editMessage(message, { content: emojiReplacement.content, components: [...newActionRows[newActionRows.indexOf(newActionRows.find((actionRow) => actionRow.guildID === broadcastRecord.guildId) || newActionRows[0])].components] });
    }));
    await interaction.editReply({ components: [...newActionRows[0].components] });
    await deleteEmojis(emojiReplacement);
};
