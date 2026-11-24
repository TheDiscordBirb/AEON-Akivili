import { CacheType, ModalSubmitInteraction } from 'discord.js';
import { ModalTypes } from '../types/modals';
import { updateEmbedModal } from './modals/update-embed';
import { errorHandler } from '../structures/error-handler';
import { Logger } from '../logger';

const logger = new Logger("Modals")

export const modalFunction = async (interaction: ModalSubmitInteraction<CacheType>) => {
    try {
        switch(interaction.customId) {
            case ModalTypes.UPDATE_EMBED: {
                await updateEmbedModal(interaction);
                break;
            }
            default: {
                return;
            }
        }
    } catch(e) {
        await errorHandler.showError({
            error: e as Error,
            user: interaction.user,
            interactionType: interaction.customId as ModalTypes
        });
        logger.error(`Got error during ${interaction.customId} modal.`, e as Error, interaction.client.user?.id);  
        await interaction.deferUpdate() 
    }
}