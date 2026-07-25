import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel,
    GuildTextBasedChannel
} from "discord.js";
import { JoinData } from "../types/database";
import { config } from "../const";
import { databaseManager } from "../structures/database";
import { JoinRequestButtonArg } from "../types/event";
import { Logger } from "../logger";
import { NetworkJoinOptions } from "../types/command";
import { rebuildNetworkInfoEmbeds } from "../utils/rebuild-comps";
import { clients } from "../structures/client";

const logger = new Logger('JoinHandler');

// TODO: test
 
class JoinHandler {
    public async requestNetworkAccess(data: JoinData) {
        const client = clients.find((client) => client.guilds.cache.has(config.mainServerId));
        if(!client) {
            throw new Error("Could not find client in main server.");
        }
        const requestEmbed = new EmbedBuilder()
            .setTitle(`New join request`)
            .setDescription(`**Network:** Aeon ${data.type}\n**Guild:** ${data.guild.name} | ${data.guild.id}\n**Channel:** ${data.channel.name} | ${data.channel.id}\n**User:** ${data.user} | ${data.user.id}`)
        
        const requestActionRow = new ActionRowBuilder<ButtonBuilder>();

        const acceptButton = new ButtonBuilder()
            .setCustomId(`${JoinRequestButtonArg.ACCEPT_REQUEST} ${data.guild.id} ${data.channel.id} ${data.type}`)
            .setStyle(ButtonStyle.Success)
            .setLabel('Accept')
        
        const rejectButton = new ButtonBuilder()
            .setCustomId(`${JoinRequestButtonArg.REJECT_REQUEST} ${data.guild.id} ${data.channel.id} ${data.type}`)
            .setStyle(ButtonStyle.Danger)
            .setLabel('Reject')
        
        requestActionRow.addComponents(acceptButton, rejectButton);
        
        const networkJoinChannel = await client.channels.fetch(config.networkJoinChannelId);

        if (!networkJoinChannel) {
            throw new Error(`Could not get network join channel`);   
        }

        return await (networkJoinChannel as TextChannel).send({ embeds: [requestEmbed], components: [requestActionRow] });
    }

    public async acceptNetworkAccessRequest(data: JoinData) {
        const client = clients.find((client) => client.guilds.cache.has(data.guild.id));
        if(!client) throw new Error("No client.");
        if(!client.user) throw new Error("No client user.");
        data.channel.createWebhook({
            name: `Aeon ${data.type}`,
            avatar: client.user.displayAvatarURL()
        })
            .then(async (webhook) => {
                if(!client.user) throw new Error("No client user.");
                if(!client.user.id) throw new Error("No client user id.");
                if (data.type !== NetworkJoinOptions.INFO) {
                    await webhook.send(`This channel is now connected to ${webhook.name}.`);
                    config.activeWebhooks.push(webhook);
                }
                if (data.type === NetworkJoinOptions.BANSHARE) {
                    await webhook.send(`Dont forget to use ***/set-important-banshare-role*** to set role that will be pinged when an important banshare is shared. (This is disabled by default)`);
                } else if (data.type === NetworkJoinOptions.INFO) {
                    const infoChannel = client.channels.cache.get(config.infoMessageChannelId);
                    if (!infoChannel) {
                        throw new Error("Could not find AEON Info channel.");
                    }
                    const infoMessage = await (infoChannel as GuildTextBasedChannel).messages.fetch(config.infoMessageId);
                    if (!infoMessage) {
                        throw new Error("Could not find AEON Info message.");
                    }
                    await webhook.send({embeds: await rebuildNetworkInfoEmbeds(infoMessage, true)})
                }
                try {
                    await databaseManager.saveBroadcast(
                        {
                            guildId: webhook.guildId, 
                            channelId: data.channel.id, 
                            channelType: data.type, 
                            webhookId: webhook.id,
                            importantBanshareRoleId: '', 
                            autoBanLevel: 0, 
                            serviceClientId: client.user.id
                            });
                    await data.guild.members.fetch();
                    if (config.nonChatWebhooks.includes(webhook.name)) return;
                    const broadcastRecords = await databaseManager.getBroadcasts();
                    const relatedBroadcastRecords = broadcastRecords.filter((broadcastRecord) => broadcastRecord.channelType === data.type);

                    await Promise.allSettled(relatedBroadcastRecords.map(async (broadcastRecord) => {
                        const broadcastWebhook = config.activeWebhooks.find((webhook) => webhook.id === broadcastRecord.webhookId);
                        if(!broadcastWebhook) {
                            logger.warn(`Could not find webhook ${broadcastRecord.webhookId}`);
                            return;
                        }
                        if(broadcastWebhook.id === webhook.id) return;

                        const webhookMessage = `${data.guild.name} has joined Aeon ${data.type}`;
                        const formating = '`';
                        if (broadcastRecord.guildId === data.guild.id) return;
                        await broadcastWebhook.send({content: `${formating}${webhookMessage}${formating}`, username: 'Akivili'});
                    }))
                } catch (error) {
                    logger.error(`Could not save broadcast. Error: `, error as Error);
                    throw error;
                }
            });
        

    }

    public async rejectNetworkAccessRequest(data: JoinData) {
        await data.channel.send({content: `Sorry, but your application to join Aeon ${data.type} has been rejected.`, allowedMentions: {parse: []}});
    }
}

export const joinHandler = new JoinHandler();