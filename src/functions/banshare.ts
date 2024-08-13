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
import { BanshareData } from "../types/database";
import { config } from "../const";
import { databaseManager } from "../structures/database";
import { BanShareButtonArg } from "../types/event";
import { client } from "../structures/client";
import { Logger } from "../logger";
import { AutoBanLevelOptions } from "../types/command";

const logger = new Logger("Banshare");

class BanshareManager {
    public async requestBanshare(data: BanshareData, client: Client, submitter: User, guildOfOrigin: Guild) {
        const mainChannel = client.channels.cache.get(config.aeonBanshareChannelId);
        if (!mainChannel) {
            logger.warn(`Could not get main channel`);
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
        const importantBanshareButton = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.IMPORTANT_BANSHARE} ${data.user.id}`)
            .setLabel(`Important Banshare 0/${config.approvalCountNeededForImportantBanshare}`)
            .setStyle(ButtonStyle.Success)
        const reject = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.REJECT_MAIN} ${data.user.id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
        
        banshareActionRow.addComponents(banshareButton, importantBanshareButton, reject);
        
        await (mainChannel as TextChannel).send({ embeds, components: [banshareActionRow] });
    }

    public async shareBanshare(data: BanshareData, importantBansharePing = false) {
        const embeds: EmbedBuilder[] = [];

        const banshareRequestEmbed = new EmbedBuilder()
            .setTitle(`**Banshare for ${data.user.username} | ${data.user.id}**`)
            .setDescription(`${data.reason}`)
            .setURL(`https://discord.com/users/${data.user.id}`);
        
        embeds.push(banshareRequestEmbed);
        
        embeds.push(...data.proof.map((image) => {
            return new EmbedBuilder()
            .setURL(`https://discord.com/users/${data.user.id}`)
            .setImage(image);
        }));

        const broadcasts = await databaseManager.getBroadcasts();
        const autoBannedContent = 'This user has been automatically banned';

        const webhookMessages = broadcasts.map(async (broadcast) => {
            if (broadcast.channelType !== 'Banshare') return;
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

            let banshareContent;
            if (broadcast.autoBanLevel >= parseInt(AutoBanLevelOptions.ALL)) {
                banshareContent = autoBannedContent;

                const autoBanned = new ButtonBuilder()
                    .setCustomId(`Auto banned`)
                    .setLabel('Auto banned')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)

                banshareActionRow.setComponents(autoBanned);
            }
            
            
            if (importantBansharePing) {
                const broadcastGuild = client.guilds.cache.find((guild) => guild.id === broadcast.guildId);
                if (!broadcastGuild) {
                    logger.warn(`Could not get broadcast guild`);
                    return undefined;
                }
                if(broadcast.importantBanshareRoleId) {
                    banshareContent = await broadcastGuild.roles.fetch(broadcast.importantBanshareRoleId);
                } else {
                    banshareContent = false;
                }
                if (broadcast.autoBanLevel >= parseInt(AutoBanLevelOptions.IMPORTANT)) {
                    banshareContent = autoBannedContent;

                    const autoBanned = new ButtonBuilder()
                        .setCustomId(`Auto banned`)
                        .setLabel('Auto banned')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)

                    banshareActionRow.setComponents(autoBanned);
                }
            }

            const webhookClient = new WebhookClient({ id: broadcast.webhookId, token: broadcast.webhookToken });
            return {
                webhookClient,
                data: { content: `${banshareContent ? banshareContent : ''}`, embeds, components: [banshareActionRow] },
            }
        });

        await Promise.allSettled(webhookMessages.map(async (webhookMessage) => {
            const awaitedWebhookMessage = await webhookMessage;
            if (!awaitedWebhookMessage) return;
            awaitedWebhookMessage.webhookClient.send(awaitedWebhookMessage.data)
                .then((message) => {
                    if (message.content === autoBannedContent) {
                        // TODO: ban user
                    }
                });
        }))
    }
}

export const banshareManager = new BanshareManager();