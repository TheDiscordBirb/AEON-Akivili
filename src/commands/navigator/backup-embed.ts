import { Command } from '../../structures/command';
import { Logger } from '../../logger';
import { permissionHandler } from '../../functions/permission-handler';
import { PermissionLevels } from '../../types/permission-handler';
import { RunOptions } from '../../types/command';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { errorHandler } from '../../structures/error-handler';
import { config } from '../../const';
import { GuildTextBasedChannel, Message } from 'discord.js';
import { readEmbedData, saveEmbed } from '../../utils/embed-caching';

const logger = new Logger('BackupEmbedCmd');

export const backupEmbedChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);

    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: false, onlyLocal: false},
        options.interaction.guild,
        [],
        PermissionLevels.NAVIGATOR);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral" });
        throw new Error(ErrorNames.NO_PERMISSIONS);
    }
    const channel = await options.client.channels.fetch(config.infoMessageChannelId);
    if(!channel) throw new Error(ErrorNames.NO_CHANNEL);
    const infoMessage = (await (channel as GuildTextBasedChannel).messages.fetch()).find((message) => message.webhookId);
    if(!infoMessage) throw new Error(ErrorNames.NO_MESSAGE);

    await backupEmbedCommand(options, infoMessage);
}

export default new Command({
    name: 'backup-embed',
    description: 'Makes a backup of the info embed.',
    options: [],

    run: async (options) => {
        try {
            await backupEmbedChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.BACKUP_EMBED
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const backupEmbedCommand = async (options: RunOptions, message: Message<true>) => {
    await saveEmbed(message);
    const decryptedData = await readEmbedData();
    await options.interaction.reply({content: "Backed up the following embed:", embeds: decryptedData, flags: 'Ephemeral'});
}