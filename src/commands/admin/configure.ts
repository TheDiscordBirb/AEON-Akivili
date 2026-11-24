import { Command } from '../../structures/command';
import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ClientUser, 
    Guild, 
    PermissionFlagsBits, 
    TextChannel 
} from 'discord.js'
import { databaseManager } from '../../structures/database';
import { Logger } from '../../logger';
import { metrics } from '../../structures/metrics';
import { TimeSpanMetricLabel } from '../../types/metrics';
import { RunOptions } from '../../types/command';
import { permissionHandler } from '../../functions/permission-handler';
import { errorHandler } from '../../structures/error-handler';
import { ErrorNames, InteractionTypes } from '../../types/error-handler';
import { BroadcastRecord } from '../../types/database'
import { clients, ExtendedClient } from '../../structures/client';
import { ulid } from 'ulid';

const logger = new Logger('ConfigureCmd');

// TODO: test
export const configureChecks = async (options: RunOptions) => {
    if (!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);

    const permissionCheck = await permissionHandler.checkForPermission(
        options.interaction.user,
        {local: true, onlyLocal: true},
        options.interaction.guild,
        [PermissionFlagsBits.BanMembers]);
        
    if(!permissionCheck.status) {
        await options.interaction.reply({ content: permissionCheck.message, flags: "Ephemeral" });
        throw new Error(ErrorNames.NO_PERMISSIONS);
    }

    const broadcasts = await databaseManager.getBroadcasts();
    const guildBroadcasts = broadcasts.filter((b) => b.guildId === options.interaction.guildId);
    if(!guildBroadcasts.length) throw new Error(ErrorNames.NO_PREVIOUS_BROADCASTS);
    const client = clients.find((c) => c.user?.id === guildBroadcasts[0].serviceClientId);
    if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);
    const guild = client.guilds.cache.get(guildBroadcasts[0].guildId);
    if(!guild) throw new Error(ErrorNames.NO_GUILD);
    const clientUser = client.user;
    if(!clientUser) throw new Error(ErrorNames.NO_CLIENT_USER);
    await configureCommand(guildBroadcasts, client, clientUser, guild, options);
}


export default new Command({
    name: 'configure',
    description: 'Configures the new bot according to the old data in the database.',
    options: [],
    
    run: async (options) => {
        const metricId = metrics.start(TimeSpanMetricLabel.CMD_BAN);
        try {
            await configureChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.CONFIGURE
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);
        }
        metrics.stop(metricId);
    }
});

export const configureCommand = async (
    guildBroadcasts: BroadcastRecord[],
    client: ExtendedClient,
    clientUser: ClientUser,
    guild: Guild,
    options: RunOptions
) => {
    const newWebhookMessages: string[] = []
    const buttons: ButtonBuilder[] = [];
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    for(const guildBroadcast of guildBroadcasts) {
        try {
            await client.fetchWebhook(guildBroadcast.webhookId);
            continue;
        } catch(e) {
            const channel = await guild.channels.fetch(guildBroadcast.channelId) as TextChannel;
            const newWebhook = await channel.createWebhook({
                name: `Aeon ${guildBroadcast.channelType}`, 
                avatar: clientUser.displayAvatarURL()
            });
            await databaseManager.saveBroadcast({
                ...guildBroadcast,
                broadcastUid: ulid(),
                webhookId: newWebhook.id,
            }, newWebhook
            );
            await databaseManager.deleteBroadcastByWebhookId(guildBroadcast.webhookId);
            const button = new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${guildBroadcast.guildId}/${guildBroadcast.channelId}`)
                .setLabel(guildBroadcast.channelType);
            buttons.push(button);
            const newWebhookMessage = `\`\`\`\ntype: ${guildBroadcast.channelType}\nid: ${newWebhook.id}\n\`\`\``
            newWebhookMessages.push(newWebhookMessage);
        }
    }
    actionRow.addComponents(buttons);
    let output = ""
    for(const newWebhookMessage of newWebhookMessages) {
        output += newWebhookMessage
    }
    if(actionRow.components.length == 0) {
        await options.interaction.reply({ content: "Could not find any webhooks in need of reconfiguring.", flags: 'Ephemeral' });
        return;
    }
    await options.interaction.reply({ content: `Webhooks updated:\n${output.trim()}`, flags: 'Ephemeral', components: [actionRow] });  
}