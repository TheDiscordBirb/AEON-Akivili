import { Command } from '../../structures/command';
import { ApplicationCommandOptionType, GuildMember, Guild } from 'discord.js'
import { databaseManager } from '../../structures/database'; 
import { hasModerationRights } from '../../utils';
import { banshareManager } from '../../functions/banshare';
import { BanshareData } from '../../structures/types';
import { BanShareOption } from '../../types/command';
import { Logger } from '../../logger';

const logger = new Logger('BanCommand');

export default new Command({
    name: 'ban',
    description: 'Bans a person using a message id from Aeon Chat',
    options: [
        {
            name: 'message-id',
            description: 'The id of the message you want to ban the sender of.',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'banshare',
            description: 'Would you like to automatically submit a banshare request on this person?',
            type: ApplicationCommandOptionType.String,
            choices: [
                { name: 'Yes', value: BanShareOption.YES },
                { name: 'No', value: BanShareOption.NO },
            ],
            required: false
        },
        {
            name: 'banshare-proof',
            description: 'If you want to submit a banshare please provide a screenshot of the message.',
            type: ApplicationCommandOptionType.Attachment,
            required: false
        }
    ],
    
    run: async (options) => {
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }
        
        const user = options.interaction.guild.members.cache.find((member) => member.id === options.interaction.member.user.id);
        if (!user) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }
        
        if (!hasModerationRights(user)) {
            await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
            return;
        }

        const banshareResponse = options.args.getString('banshare');
        const attachment = options.args.getAttachment('banshare-proof');
        if (!attachment && (banshareResponse == BanShareOption.YES)) {
            await options.interaction.reply({ content: 'If you want to automatically banshare this person please provide a screenshot of their message.', ephemeral: true });
            return;
        }
        
        
        if (!options.interaction.channel) {
            logger.wtf(`${options.interaction.member.user.username} has used a command without a channel.`);
            return;
        }
        
        
        const messageId = options.args.getString('message-id');
        if (!messageId) {
            logger.warn(`${options.interaction.member.user.username} has used a command without the required field 'message-id'.`);
            await options.interaction.reply({ content: 'No message id provided.', ephemeral: true });
            return;
        }
        
        const userId = await databaseManager.getUserId(options.interaction.channel.id, messageId);
        const broadcasts = await databaseManager.getBroadcasts();
        const guilds: Record<string, Guild> = {};
        const guildIdsFromCache = Object.keys(options.client.guilds.cache);
        for (const broadcast of broadcasts) {
            const guildIndex = guildIdsFromCache.findIndex((guildId) => guildId === broadcast.guildId);
            if (guildIndex) {
                const guild = options.client.guilds.cache.at(guildIndex);
                if (!guild) {
                    logger.wtf(`No guild at the guildIndex of ${guildIndex} was found.`);
                    continue;
                }
                guilds[broadcast.guildId] = guild;
            }
        }
        
        const userInfo = Object.values(guilds).reduce<{guildMember?:GuildMember, userIsModerator:boolean}>((acc, guild) => {
            if (acc.userIsModerator) return acc;
            const guildMember = guild.members.cache.find((user) => user.id === userId);
            if (!guildMember) return acc;
            if (hasModerationRights(guildMember)) {
                return {guildMember: guildMember, userIsModerator: true};
            }
            return { guildMember: guildMember, userIsModerator: acc.userIsModerator };
        }, {guildMember: undefined, userIsModerator: false});
        
        
        if (userInfo.userIsModerator) {
            await options.interaction.reply({ content: 'This user is a moderator on a server in the network, please submit a banshare request with a screenshot of the message.', ephemeral: true });
            return;
        }

        if (!userInfo.guildMember) {
            await options.interaction.reply({ content: 'Could not find that user.', ephemeral: true });
            return;
        }
        
        await options.interaction.reply({ content: `${userInfo.guildMember} has been banned. (For now this feature is only a proof of concept, it will be functional after open beta)`, ephemeral: true });
        // TODO: ban user

        if (!banshareResponse || (banshareResponse == BanShareOption.NO)) return;
        if (!attachment) {
            await options.interaction.reply({ content: 'There was a problem with the attachment provided.', ephemeral: true });
            return;
        }
        
        const targetUser = options.client.users.cache.find((user) => user.id === userInfo.guildMember?.id);
        if (!targetUser) {
            await options.interaction.reply({ content: 'Could not find target user.', ephemeral: true });
            return;
        }
        
        
        const message = await options.interaction.channel.messages.fetch(messageId);
        if (!message) {
            await options.interaction.reply({ content: 'This message does not exist.', ephemeral: true });
            return;
        }
        
        const data: BanshareData = {
            user: targetUser,
            reason: `${targetUser.username} said in Aeon Chat:\n"${message.content}"`,
            proof: [attachment.url]
        };

        try {
            await banshareManager.requestBanshare(data, options.client, options.interaction.member.user, options.interaction.guild);
            await options.interaction.editReply({ content: `${targetUser} has been banned and banshare has been submitted. (For now this feature is only a proof of concept, it will be functional after open beta)` });
        } catch (error) {
            logger.error('Could not ban user / share ban', error as Error)
        }
    }
});