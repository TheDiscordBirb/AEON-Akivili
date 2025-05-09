import { Command } from '../../structures/command';
import { BaseGuildTextChannel, ChannelType, Guild } from 'discord.js'
import { Logger } from '../../logger';
import { config } from '../../const';
import { clearanceLevel } from '../../utils';
import { ClearanceLevel } from '../../types/client';
import { client } from '../../structures/client';
import { databaseManager } from '../../structures/database';

const logger = new Logger('DisconnectCmd');

export default new Command({
    name: 'disconnect',
    description: "Disconnects a channel from the network connection.",
    options:[],

    run: async (options) => {
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }

        const channel = options.interaction.channel as BaseGuildTextChannel;
        if (channel.type !== ChannelType.GuildText) return;

        const user = options.interaction.guild.members.cache.get(options.interaction.member.user.id);
        if (!user) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }

        if(!(clearanceLevel(user.user, user.guild, true) === ClearanceLevel.MODERATOR || clearanceLevel(user.user) >= ClearanceLevel.NAVIGATOR)) {
            await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
            return;
        }
        
        const webhook = config.activeWebhooks.find((webhook) => webhook.channelId === channel.id);
        if(!webhook) {
            await options.interaction.reply({content: "Could not find Aeon webhook in this channel."});
            return;
        }
        const webhookChannelType = (await databaseManager.getBroadcast(webhook.id))?.channelType;
        if(!webhookChannelType) {
            logger.warn("Could not get webhook channel type.");
            return;
        }


        let leavingGuild: Guild | undefined;
        try {
            const webhookName = webhook.name;
            leavingGuild = client.guilds.cache.get(webhook.guildId);
            if (!leavingGuild) {
                await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, ephemeral: true });
                logger.warn(`Could not get webhook guild`);
                return
            }
            await webhook.delete();
            await options.interaction.reply(`Successfully disconnected from ${webhookName}`);
        } catch (error) {
            await options.interaction.reply({ content: `Could not remove this channel from the network, for more info contact Birb.`, ephemeral: true });
            logger.error(`Could not disconnect channel. Error:`, (error as Error));
        }

        if (config.nonChatWebhooks.includes(webhook.name)) return;
        const relatedWebhooks = config.activeWebhooks.filter((webhook) => webhook.name.slice(5) === webhookChannelType);

        await Promise.allSettled(relatedWebhooks.map(async (relatedWebhook) => {
            const guild = client.guilds.cache.get(relatedWebhook.guildId);
            if (!guild) {
                logger.warn(`Could not find guild with id ${relatedWebhook.guildId}`);
                return;
            }

            const webhookMessage = `${leavingGuild ? leavingGuild.name : "A server"} has left Aeon ${webhookChannelType}`;
            const formating = '`';
            await relatedWebhook.send({content: `${formating}${webhookMessage}${formating}`, username: 'Akivili'});
        }))
    }
});