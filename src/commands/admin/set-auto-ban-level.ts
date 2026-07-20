import { ApplicationCommandOptionType, BaseGuildTextChannel, ChannelType, PermissionFlagsBits } from 'discord.js'
import { Command } from '../../structures/command';
import { databaseManager } from '../../structures/database';
import { AutoBanLevelOptions, NetworkJoinOptions, RunOptions } from '../../types/command';
import { Logger } from '../../logger';
import { permissionHandler } from '../../functions/permission-handler';
import { errorHandler } from '../../structures/error-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { BroadcastRecord } from '../../types/database';

const logger = new Logger('SetAutoBanLevelCmd');

export const setAutoBanLevelChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);

    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: true},
        options.interaction.guild,
        [PermissionFlagsBits.Administrator]);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({content: permissionCheck.message, flags: "Ephemeral"});
        throw new Error(ErrorNames.NO_PERMISSIONS);
    }

    const channel = options.interaction.channel as BaseGuildTextChannel;
    if (channel.type !== ChannelType.GuildText) throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);

    const broadcastRecords = await databaseManager.getBroadcasts();
    const channelBroadcast = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
    if (!channelBroadcast) throw new Error(ErrorNames.NO_BROADCAST_IN_DB)
    if (channelBroadcast.channelType !== NetworkJoinOptions.BANSHARE) throw new Error(ErrorNames.WRONG_CHANNEL_TYPE);

    const webhook = await options.client.fetchWebhook(channelBroadcast.webhookId);
    if (!webhook) throw new Error(ErrorNames.DID_NOT_FIND_WEBHOOK);

    const optionsLevel = options.args.getString('level');
    if (!optionsLevel) throw new Error(ErrorNames.NO_REQUIRED_FIELD);

    const autoBanLevel = parseInt(optionsLevel);

    await setAutoBanLevelCommand(
        optionsLevel,
        channelBroadcast,
        autoBanLevel,
        options
    );
}

// TODO: test
export default new Command({
    name: 'set-auto-ban-level',
    description: 'Sets the level where banshares automatically get executed.',
    options:
    [{
        name: 'level',
        description: 'The level where banshares automatically get executed.',
        type: ApplicationCommandOptionType.String,
        choices: [
            { name: "None", value: AutoBanLevelOptions.NONE },
            { name: "Important", value: AutoBanLevelOptions.IMPORTANT },
            { name: "All", value: AutoBanLevelOptions.ALL }
        ],
        required: true
    }],

    run: async (options) => {
        try {
            await setAutoBanLevelChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.SET_AUTO_BAN_LEVEL
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const setAutoBanLevelCommand = async (
    optionsLevel: string, 
    channelBroadcast: BroadcastRecord,
    autoBanLevel: number,
    options: RunOptions
) => {
    let autoBanLevelName;
    switch (optionsLevel) {
        case AutoBanLevelOptions.NONE: {
            autoBanLevelName = 'None';
            break;
        }
        case AutoBanLevelOptions.IMPORTANT: {
            autoBanLevelName = 'Important';
            break;
        }
        case AutoBanLevelOptions.ALL: {
            autoBanLevelName = 'All';
            break;
        }
    }

    await databaseManager.saveBroadcast({ ...channelBroadcast, autoBanLevel });
    await options.interaction.reply(`This server's auto ban level has been set to ${autoBanLevelName}.`);
}