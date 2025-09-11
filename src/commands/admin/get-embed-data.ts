import { Command } from '../../structures/command';
import { ApplicationCommandOptionType} from 'discord.js'
import { Logger } from '../../logger';
import { writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { hasModerationRights } from '../../utils';

const logger = new Logger('GetEmbedData');

export default new Command({
    name: 'get-embed-data',
    description: "Getting the data from embeds.",
    options:
    [{
        name: 'message-id',
        description: 'The id of the message you want to get the uid of.',
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
        const guildMember = options.interaction.guild?.members.cache.find(m => m.id === options.interaction.member.user.id);

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

        const message = await options.interaction.channel.messages.fetch(messageId);

        try {
            unlinkSync(path.join(__dirname, '..', '..', '..', 'embed.json'));
        } catch (error) {
            logger.warn(`Couldnt unlink embed.json`, (error as Error));
        }

        let embedJsonData = '[';
        for (const embed of message.embeds) {
            embedJsonData += `${JSON.stringify(embed.toJSON(), null, 2)},\n`;
        }
        embedJsonData = embedJsonData.slice(0, embedJsonData.length - 2) + ']';
        if (!message.embeds.length) {
            embedJsonData = '[]';
        }

        writeFileSync(path.join(__dirname, '..', '..', '..', 'embed.json'), embedJsonData, { flag: 'a' });
        await options.interaction.reply({ files: [path.join(__dirname, '..', '..', '..', 'embed.json')], ephemeral: true });
    }
});