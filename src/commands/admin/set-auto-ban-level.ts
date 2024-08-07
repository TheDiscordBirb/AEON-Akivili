import { ApplicationCommandOptionType, BaseGuildTextChannel, ChannelType } from 'discord.js'
import { Command } from '../../structures/command';
import { hasModerationRights } from '../../utils';
import { databaseManager } from '../../structures/database';
import { AutoBanLevelOptions, NetworkJoinOptions } from '../../types/command';
import { Logger } from '../../logger';

const logger = new Logger('SetAutoBanLevelCmd');

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
        if (!options.interaction.member) {
            await options.interaction.reply({ content: `You cant use this command outside a server.`, ephemeral: true });
            logger.warn(`Didnt get interaction member`);
            return;
        }
        if (!hasModerationRights(options.interaction.member)) {
            await options.interaction.reply({ content: `You do not have permission to use this!`, ephemeral: true });
            return;
        }

        const channel = options.interaction.channel as BaseGuildTextChannel;
        if (channel.type !== ChannelType.GuildText) return;

        const broadcastRecords = await databaseManager.getBroadcasts();
        const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
        if (!channelWebhook) {
            await options.interaction.reply({ content: `No channel webhook.`, ephemeral: true });
            return;
        }
        if (channelWebhook.channelType !== NetworkJoinOptions.BANSHARE) {
            await options.interaction.reply({ content: `No Aeon Banshare connection in this channel.`, ephemeral: true });
            return;
        }

        let webhook;
        try {
            webhook = await options.client.fetchWebhook(channelWebhook.webhookId);
        } catch (error) {
            logger.error(`Could not fetch webhook in guild: ${options.interaction.guild?.name ?? 'Unknown'} channel: ${channel.name ?? 'Unknown'}`, error as Error)
            return;
        };
        
        if (!webhook) {
            await options.interaction.reply({ content: `No webhook in this channel`, ephemeral: true });
            return;
        }
        if (!webhook.token) {
            await options.interaction.reply({ content: "Couldnt get Aeon webhook token, contact Birb to resolve this issue." });
            return;
        }

        const optionsLevel = options.args.getString('level');
        if (optionsLevel === null) {
            logger.wtf(`${options.interaction.member.user.username} has used a command without the required field 'level'.`);
            return;
        };

        const autoBanLevel = parseInt(optionsLevel);
        if (isNaN(autoBanLevel)) {
            logger.wtf(`I set these up myself, how is it NaN.`);
            return;
        }

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

        try {
            await databaseManager.saveBroadcast({ ...channelWebhook, autoBanLevel });
            await options.interaction.reply(`This server's auto ban level has been set to ${autoBanLevelName}.`);
        } catch (error) {
            logger.error(`Could not save broadcast. Error: `, error as Error);
            return;
        }
    }
});