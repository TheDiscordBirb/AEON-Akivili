import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel
} from "discord.js";
import { JoinData } from "../structures/types";
import { client } from "../structures/client";
import { config } from "../const";
import { databaseManager } from "../structures/database";
import { BanShareButtonArg } from "../types/event";

class JoinHandler {
    constructor() { }
    
    public async requestNetworkAccess(data: JoinData) {
        let requestEmbed = new EmbedBuilder()
            .setTitle(`New join request`)
            .setDescription(`**Network:** Aeon ${data.type}\n**Guild:** ${data.guild.name}\n**Channel:** ${data.channel.name}`)
        
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
        
        let channel = client.channels.cache.find((channel) => channel.id === config.networkJoinChannelId);

        if (!channel) {
            // TODO: rep        
            return;
        }

        await (channel as TextChannel).send({ embeds: [requestEmbed], components: [requestActionRow] });
    }

    public async acceptNetworkAccessRequest(data: JoinData) {
        data.channel.createWebhook({
            name: `Aeon ${data.type}`,
            avatar: client.user?.displayAvatarURL()
        })
            .then(async (webhook) => {
                await webhook.send(`This channel is now connected to ${webhook.name}.`)
                databaseManager.saveBroadcast({ guildId: webhook.guildId, channelId: data.channel.id, channelType: data.type, webhookId: webhook.id, webhookToken: webhook.token });
            });
        

    }

    public async rejectNetworkAccessRequest(data: JoinData) {
        await data.channel.send({content: `Sorry, but your application to join Aeon ${data.type} has been rejected, for more details please contact <@480956116482785299>`, allowedMentions: {parse: []}});
    }
}

export const joinHandler = new JoinHandler();