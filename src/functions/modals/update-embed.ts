import { CacheType, EmbedBuilder, GuildTextBasedChannel, ModalSubmitInteraction, WebhookType } from 'discord.js';
import { ModalInputIds } from '../../types/modals';
import { rebuildNetworkInfoEmbeds } from '../../utils/rebuild-comps';
import { ErrorNames } from '../../types/error-handler';
import { config } from '../../const';
import { databaseManager } from '../../structures/database';
import { NetworkJoinOptions } from '../../types/command';
import { saveEmbed } from '../../utils/embed-caching';

export const updateEmbedModal = async (interaction: ModalSubmitInteraction<CacheType>) => {
    if(!interaction.message) throw new Error(ErrorNames.NO_MESSAGE);
    let newEmbeds: EmbedBuilder[] = []
    try {
        const removeInput = interaction.fields.getTextInputValue(ModalInputIds.EMBED_REMOVE_SERVER + "a");
        newEmbeds = await rebuildNetworkInfoEmbeds(interaction.message, undefined, `https://discord.gg/${removeInput}`, true);
    } catch(e) {
        try {
            const serverNameInput = interaction.fields.getTextInputValue(ModalInputIds.EMBED_ADD_SERVER_NAME);
            const serverInviteInput = interaction.fields.getTextInputValue(ModalInputIds.EMBED_ADD_SERVER_INVITE);
            newEmbeds = await rebuildNetworkInfoEmbeds(interaction.message, serverNameInput, serverInviteInput);
        } catch(e) {
            throw ErrorNames.WRONG_MODAL_INPUT;
        }
    }
    const ogInteraction = config.cachedInteractions.find((i) => i.user.id === interaction.user.id);
    if(!ogInteraction) throw new Error(ErrorNames.NO_USER);
    const newMessage = await ogInteraction.editReply({embeds: newEmbeds});
    await saveEmbed(newMessage);
    await interaction.deferUpdate();
    config.cachedInteractions.splice(config.cachedInteractions.indexOf(ogInteraction), 1);

    const broadcastRecords = await databaseManager.getBroadcasts();
    const matchingBroadcastRecords = broadcastRecords.filter((broadcastRecord) => broadcastRecord.channelType === NetworkJoinOptions.INFO);
    await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
        const webhook = config.activeWebhooks.find((webhook) => webhook.id === broadcastRecord.webhookId);
        if(!webhook) throw new Error(ErrorNames.NO_WEBHOOK);
        const broadCastChannel = webhook.channel;
        if (!broadCastChannel) throw new Error(ErrorNames.NO_CHANNEL);
        const guildMessage = (await (broadCastChannel as GuildTextBasedChannel).messages.fetch()).find((message) => message.webhookId === webhook.id);
        if (!guildMessage) {
            await webhook.send({embeds: newEmbeds});
        } else {
            await webhook.editMessage(guildMessage, { embeds: newEmbeds});
        }
    })).catch((e) => {
        throw e;
    });
}