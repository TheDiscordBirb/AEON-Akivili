import {
    Client,
    EmbedBuilder,
    Guild,
    User,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    WebhookClient,
    TextChannel
} from "discord.js";
import { BanshareData } from "../structures/types";
import { config } from "../const";
import { databaseManager } from "../structures/database";
import { BanShareButtonArg } from "../types/event";

class BanshareManager {
    constructor() { }
    
    public async requestBanshare(data: BanshareData, client: Client, submitter: User, guildOfOrigin: Guild) {
        const mainChannel = client.channels.cache.get(config.aeonBanshareChannelId);
        if (!mainChannel) {
            // TODO: write log
            return;
        }


        const banshareRequestEmbed = new EmbedBuilder()
            .setAuthor({ name: `${submitter.displayName} | ${guildOfOrigin.name}`, iconURL: submitter.displayAvatarURL() })
            .setTitle(`**Banshare request for ${data.user.username} | ${data.user.displayName}**`)
            .setDescription(`Reason: ${data.reason}\n\nProof:`)
            .setURL(`https://discord.com/users/${data.user.id}`);
        
            
        const embeds: EmbedBuilder[] = [];
        
        embeds.push(banshareRequestEmbed);
        
        embeds.push(...data.proof.map((image) => {
            return new EmbedBuilder()
            .setURL(`https://discord.com/users/${data.user.id}`)
            .setImage(image);
        }));
        
        
        const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

        const banshareButton = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.BANSHARE} ${data.user.id}`)
            .setLabel('Banshare')
            .setStyle(ButtonStyle.Success)
        /*
        const blanketBanButton = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.BLANKET_BAN} ${data.user.id}`)
            .setLabel(`Blanket Ban 0/${config.approvalCountNeededForBlanketBan}`)
            .setStyle(ButtonStyle.Success)
        */
        const reject = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.REJECT_MAIN} ${data.user.id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
        
        banshareActionRow.addComponents(banshareButton, /*blanketBanButton,*/ reject);
        
        await (mainChannel as TextChannel).send({ embeds, components: [banshareActionRow] });
    }

    public async shareBanshare(data: BanshareData) {
        const embeds: EmbedBuilder[] = [];

        const banshareRequestEmbed = new EmbedBuilder()
            .setTitle(`**Banshare for ${data.user.username} | ${data.user.displayName}**`)
            .setDescription(`${data.reason}`)
            .setURL(`https://discord.com/users/${data.user.id}`);
        
        embeds.push(banshareRequestEmbed);
        
        embeds.push(...data.proof.map((image) => {
            return new EmbedBuilder()
            .setURL(`https://discord.com/users/${data.user.id}`)
            .setImage(image);
        }));
        
        const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

        const banFromServerButton = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.BAN_FROM_SERVER} ${data.user.id}`)
            .setLabel('Ban')
            .setStyle(ButtonStyle.Success)
        const reject = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.REJECT_SUB} ${data.user.id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
        
        banshareActionRow.addComponents(banFromServerButton, reject);

        const broadcasts = await databaseManager.getBroadcasts();

        const webhookMessages = broadcasts.map((broadcast) => {
            if (broadcast.channelType !== 'Banshare') return undefined;
            const webhookClient = new WebhookClient({ id: broadcast.webhookId, token: broadcast.webhookToken });
            return {
                webhookClient,
                data: { embeds, components: [banshareActionRow] },
            }
        });

        await Promise.allSettled(webhookMessages.map(async (webhookMessage) => {
            if (!webhookMessage) return;
            await webhookMessage.webhookClient.send(webhookMessage.data);
        }))
    }
}

export const banshareManager = new BanshareManager();