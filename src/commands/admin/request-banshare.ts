import { Command } from '../../structures/command';
import { ApplicationCommandOptionType } from 'discord.js'
import { hasModerationRights } from '../../utils';
import { banshareManager } from '../../functions/banshare';
import { BanshareData } from '../../types/database';
import { Logger } from '../../logger';

const logger = new Logger('RequestBanshareCmd');

export default new Command({
    name: 'request-banshare',
    description: 'Requests a banshare for a specific person.',
    options:
    [{
        name: 'user-id',
        description: 'The id of the user you want to banshare.',
        type: ApplicationCommandOptionType.String,
        required: true
    },
    {
        name: 'reason',
        description: 'The reason you want to banshare this user for.',
        type: ApplicationCommandOptionType.String,
        required: true
    },
    {
        name: 'proof',
        description: 'Proof of the user breaking rules.',
        type: ApplicationCommandOptionType.Attachment,
        required: true
    },
    {
        name: 'proof2',
        description: 'Additional field to submit proof',
        type: ApplicationCommandOptionType.Attachment,
        required: false
    },
    {
        name: 'proof3',
        description: 'Additional field to submit proof',
        type: ApplicationCommandOptionType.Attachment,
        required: false
    },
    {
        name: 'proof4',
        description: 'Additional field to submit proof',
        type: ApplicationCommandOptionType.Attachment,
        required: false
    }],

    run: async (options) => {
        const guildMember = options.interaction.guild?.members.cache.find((member) => member.id === options.interaction.member.user.id);
        if (!guildMember) {
            logger.wtf("Interaction's creator does not exist.");
            return;
        }

        if (!hasModerationRights(guildMember)) {
            await options.interaction.reply({ content: 'You do not have permission to use this!', ephemeral: true });
            return;
        }

        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }

        if (!options.args.getString('user-id')) {
            logger.warn(`${options.interaction.member.user.username} has used a command without the required field 'reason'.`);
            await options.interaction.reply({ content: `No user id provided.`, ephemeral: true });
            return;
        }

        const targetUser= options.client.users.cache.find((user) => user.id === options.args.getString('user-id'));
        if (!targetUser) {
            await options.interaction.reply({ content: 'Could not find that user on the network, if you wish to submit a banshare for someone outside the network, please do it manually in <#1259191393935556608>.', ephemeral: true });
            return;
        };

        const proof: string[] = [];

        for (const option of options.args.data) {
            if (option.attachment) {
                proof.push(option.attachment.url);
            };
        };

        const banshareReason = options.args.getString('reason');
        if (!banshareReason) {
            logger.warn(`${options.interaction.member.user.username} has used a command without the required field 'reason'.`);
            await options.interaction.reply({ content: `No reason provided.`, ephemeral: true });
            return;
        }
        
        const data: BanshareData = { user: targetUser, reason: banshareReason, proof };

        try {
            await banshareManager.requestBanshare(data, options.client, options.interaction.member.user, options.interaction.guild);
            await options.interaction.reply({ content: `Banshare for ${targetUser} has been submitted.`, ephemeral: true });
        } catch (error) {
            logger.error('Could not send banshare', error as Error);
        }
    }
});