import { ApplicationCommandOptionType, BaseGuildTextChannel, ChannelType } from 'discord.js'
import { Command } from '../../structures/command';
import { databaseManager } from '../../structures/database';
import { AutoBanLevelOptions } from '../../types/command';
import { Logger } from '../../logger';
import { config } from '../../const';
import { clearanceLevel } from '../../utils';
import { ClearanceLevel } from '../../types/client';

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
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }
        const guildMember = options.interaction.guild.members.cache.find(m => m.id === options.interaction.member.user.id);

        if (!guildMember) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }

        if(clearanceLevel(guildMember.user, guildMember.guild, true) === ClearanceLevel.MODERATOR) {
            await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
            return;
        }

        const channel = options.interaction.channel as BaseGuildTextChannel;
        if (channel.type !== ChannelType.GuildText) return;

        const webhooks = config.activeWebhooks;
        const channelWebhook = webhooks.find((webhook) => webhook.channelId === channel.id);
        if (!channelWebhook) {
            await options.interaction.reply({ content: `No channel webhook.`, ephemeral: true });
            return;
        }
        if (!config.nonChatWebhooks.includes(channelWebhook.name)) {
            await options.interaction.reply({ content: `No Aeon Banshare connection in this channel.`, ephemeral: true });
            return;
        }
        
        if (!channelWebhook) {
            await options.interaction.reply({ content: `No webhook in this channel`, ephemeral: true });
            return;
        }
        if (!channelWebhook.token) {
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

        const currentConfigForBroadcast = await databaseManager.getBroadcast(channelWebhook.id);
        if(!currentConfigForBroadcast) {
            await options.interaction.reply("Could not find config for this webhook, please regenerate it by deleting the current one and using /join-network again.");
            return;
        }
        try {
            await databaseManager.saveBroadcast({ ...currentConfigForBroadcast, autoBanLevel });
            await options.interaction.reply(`This server's auto ban level has been set to ${autoBanLevelName}.`);
        } catch (error) {
            logger.error(`Could not save broadcast. Error: `, error as Error);
            return;
        }
    }
});