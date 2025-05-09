import { Command } from '../../structures/command';
import { GuildMember } from 'discord.js';
import { Logger } from '../../logger';
import { client } from '../../structures/client';
import { banshareManager } from '../../functions/banshare';
import { config } from '../../const';
import { clearanceLevel } from '../../utils';
import { ClearanceLevel } from '../../types/client';

const logger = new Logger('RequestBanshareCmd');

export default new Command({
    name: 'request-banshare',
    description: 'Starts the process to request a banshare.',
    options: [],
    
    run: async (options) => {
        const guild = options.interaction.guild;
        if (!guild) {
            await options.interaction.reply({ content: "To have a complete paper trail of every banshare, this command can only be used in servers", ephemeral: true });
            return;
        }
        const webhooks = config.activeWebhooks;
        const userInfo = Object.values(webhooks).reduce<{ guildMember?: GuildMember, userIsModerator: boolean }>((acc, webhook) => {
            const guild = client.guilds.cache.get(webhook.guildId);
            if (!guild) return acc;
            if (acc.userIsModerator) return acc;
            const guildMember = guild.members.cache.find((user) => user.id === options.interaction.member.id);
            if (!guildMember) return acc;
            if (clearanceLevel(guildMember.user, guild, true) === ClearanceLevel.MODERATOR) {
                return {guildMember, userIsModerator: true};
            }
            return { guildMember, userIsModerator: false };
        }, { guildMember: undefined, userIsModerator: false });

        const guildInfo = Object.values(webhooks).reduce<{guildId?: string}>((acc, webhook) => {
            if(webhook.guildId === options.interaction.guildId && !config.nonChatWebhooks.includes(webhook.name)) return {guildId: webhook.guildId};
            return acc;
        }, { guildId: undefined});
        if (!userInfo.userIsModerator) {
            await options.interaction.reply({ content: "You dont have permissions to use this.", ephemeral: true });
        }

        if(!guildInfo.guildId) {
            await options.interaction.reply({content: "Sorry, this can only be used in AEON Network servers.", ephemeral: true});
            return;
        }
        await options.interaction.reply({ content: "Check your dms for a message from Akivili, if you cant find one enable dms from this server.", ephemeral: true });

        await banshareManager.dmBanshareFunction(guild.id, options);
    }
});