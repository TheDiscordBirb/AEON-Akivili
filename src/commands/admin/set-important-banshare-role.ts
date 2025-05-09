import { ApplicationCommandOptionType, BaseGuildTextChannel, ChannelType, } from 'discord.js';
import { Command } from '../../structures/command';
import { databaseManager } from '../../structures/database';
import { Logger } from '../../logger';
import { config } from '../../const';
import { clearanceLevel } from '../../utils';
import { ClearanceLevel } from '../../types/client';

const logger = new Logger('SetBanshareRole');

export default new Command({
    name: 'set-important-banshare-role',
    description: "Set the role that gets pinged when a new important banshare is posted.",
    options:
    [{
        name: 'role',
        description: 'Leave this blank if you want to remove the current role',
        type: ApplicationCommandOptionType.Role,
        required: false
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

        let role = options.args.getRole('role');

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

        const currentConfigForBroadcast = await databaseManager.getBroadcast(channelWebhook.id);
        if(!currentConfigForBroadcast) {
            await options.interaction.reply("Could not find config for this webhook, please regenerate it by deleting the current one and using /join-network again.");
            return;
        }
        try {
            await databaseManager.saveBroadcast({ ...currentConfigForBroadcast, importantBanshareRoleId: (role ? role.id : '') });
            await options.interaction.reply({ content: `Your important banshare ping role has been ${role ? `set to ${role}` : `removed`}`, allowedMentions: { parse: [] } });
        } catch (error) {
            logger.error(`Could not save broadcast. Error: `, error as Error);
            return;
        }
    }
})