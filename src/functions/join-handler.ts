import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel,
    GuildTextBasedChannel,
    WebhookClient
} from "discord.js";
import { JoinData } from "../types/database";
import { client } from "../structures/client";
import { config } from "../const";
import { databaseManager } from "../structures/database";
import { BanShareButtonArg } from "../types/event";
import { Logger } from "../logger";
import { NetworkJoinOptions } from "../types/command";
import { rebuildNetworkInfoEmbeds } from "../utils";

const logger = new Logger('JoinHandler');

class JoinHandler {
    public async requestNetworkAccess(data: JoinData) {
        let requestEmbed = new EmbedBuilder()
            .setTitle(`New join request`)
            .setDescription(`**Network:** Aeon ${data.type}\n**Guild:** ${data.guild.name} | ${data.guild.id}\n**Channel:** ${data.channel.name} | ${data.channel.id}\n**User:** ${data.user} | ${data.user.id}`)
        
        let requestActionRow = new ActionRowBuilder<ButtonBuilder>();

        let acceptButton = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.ACCEPT_REQUEST} ${data.guild.id} ${data.channel.id} ${data.type}`)
            .setStyle(ButtonStyle.Success)
            .setLabel('Accept')
        
        let rejectButton = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.REJECT_REQUEST} ${data.guild.id} ${data.channel.id} ${data.type}`)
            .setStyle(ButtonStyle.Danger)
            .setLabel('Reject')
        
        requestActionRow.addComponents(acceptButton, rejectButton);
        
        let networkJoinChannel = client.channels.cache.find((channel) => channel.id === config.networkJoinChannelId);

        if (!networkJoinChannel) {
            logger.warn(`Could not get network join channel`);   
            return;
        }

        await (networkJoinChannel as TextChannel).send({ embeds: [requestEmbed], components: [requestActionRow] });
    }

    public async acceptNetworkAccessRequest(data: JoinData) {
        data.channel.createWebhook({
            name: `Aeon ${data.type}`,
            avatar: client.user?.displayAvatarURL()
        })
            .then(async (webhook) => {
                if (data.type !== NetworkJoinOptions.INFO) {
                    await webhook.send(`This channel is now connected to ${webhook.name}.`);
                }
                if (data.type === NetworkJoinOptions.BANSHARE) {
                    await webhook.send(`Dont forget to use ***/set-important-banshare-role*** to set role that will be pinged when an important banshare is shared. (This is disabled by default)`);
                } else if (data.type === NetworkJoinOptions.INFO) {
                    const infoChannel = client.channels.cache.get(config.infoMessageChannelId);
                    if (!infoChannel) {
                        //TODO: write log
                        return;
                    }
                    const infoMessage = await (infoChannel as GuildTextBasedChannel).messages.fetch(config.infoMessageId);
                    if (!infoMessage) {
                        //TODO: write log
                        return;
                    }
                    await webhook.send({embeds: await rebuildNetworkInfoEmbeds(infoMessage)})
                }
                try {
                    await databaseManager.saveBroadcast({ guildId: webhook.guildId, channelId: data.channel.id, channelType: data.type, webhookId: webhook.id, webhookToken: webhook.token, importantBanshareRoleId: '', autoBanLevel: 0 });
                    await data.guild.members.fetch();
                    if (config.nonChatWebhooks.includes(webhook.name)) return;
                    const broadcastRecords = await databaseManager.getBroadcasts();
                    const relatedBroadcastRecords = broadcastRecords.filter((broadcastRecord) => broadcastRecord.channelType === data.type);

                    await Promise.allSettled(relatedBroadcastRecords.map(async (broadcastRecord) => {
                        const webhook = new WebhookClient({ id: broadcastRecord.webhookId, token: broadcastRecord.webhookToken });

                        const webhookMessage = `${data.guild.name} has joined Aeon ${data.type}`;
                        const formating = '`';
                        if (broadcastRecord.guildId === data.guild.id) return;
                        await webhook.send({content: `${formating}${webhookMessage}${formating}`, username: 'Akivili'});
                    }))
                } catch (error) {
                    logger.error(`Could not save broadcast. Error: `, error as Error);
                    return;
                }
            });
        

    }

    public async rejectNetworkAccessRequest(data: JoinData) {
        await data.channel.send({content: `Sorry, but your application to join Aeon ${data.type} has been rejected, for more details please contact <@1201610070916603984>`, allowedMentions: {parse: []}});
    }
}

export const joinHandler = new JoinHandler();