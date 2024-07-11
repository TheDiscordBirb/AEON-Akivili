import { banshareManager } from "../functions/banshare";
import { Event } from "../structures/event";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, TextChannel, Guild } from "discord.js";
import { hasModerationRights } from "../utils";
import { client } from "../structures/client";
import { joinHandler } from "../functions/join-handler";
import { Logger } from "../logger";
import { BanShareButtonArg } from "../types/event";
import { config } from "../const";
import { databaseManager } from "../structures/database";

const logger = new Logger("Buttons");

export default new Event("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    interaction.deferUpdate();
    const guildMember = interaction.member ? interaction.member as GuildMember : null;

    if (!guildMember) {
        logger.wtf("Interaction's creator does not exist.");
        return;
    }

    if (!hasModerationRights(guildMember)) {
        (await interaction.user.createDM(true)).send('You do not have permission to use this.');
        return;
    };
    const customIdArgs = interaction.customId.split(' ');

    if (!customIdArgs.length) {

        return;
    }
    const command = customIdArgs.shift();
    switch (command) {
        //Banshare

        //Main server
        case BanShareButtonArg.BANSHARE: {
            if (customIdArgs.length !== 1) {
                // TODO: write log
                return;
            }
            const userId = customIdArgs[0];
            const user = interaction.client.users.cache.find((user) => user.id === userId);
            if (!user) {
                logger.wtf("Interaction's creator does not exist.");
                return;
            }

            const reason = interaction.message.embeds[0].description;
            if (!reason) {
                logger.wtf(`${interaction.message.embeds[0].url} embed doesnt have a description.`);
                return;
            }

            const proof: string[] = [];
            interaction.message.embeds.forEach((embed) => {
                if (embed.image) {
                    proof.push(embed.image.url);
                }
            });

            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

            const banshareButton = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.BANSHARE} ${userId}`)
                .setLabel('Banshared')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)

            banshareActionRow.addComponents(banshareButton);

            try {
                await interaction.message.edit({ components: [banshareActionRow] });
                await banshareManager.shareBanshare({ user, reason, proof });
            } catch (error) {
                logger.error('Failed to edit buttons/send banshare.',error as Error);
            }
            break;
        }
        case BanShareButtonArg.BLANKET_BAN: {
            if ((customIdArgs.length < 2) || (customIdArgs.length > 2 + config.approvalCountNeededForBlanketBan)) {
                // TODO: write log
                return;
            }
            const currentApprover = interaction.user;
            const userId = customIdArgs[0];
            const approvers = customIdArgs.slice(1, 1 + config.approvalCountNeededForBlanketBan);

            const currentApproverIndex = approvers.findIndex((approver) => approver === currentApprover.id);
            if (currentApproverIndex === -1) {
                approvers.push(currentApprover.id);
            } else {
                approvers.splice(currentApproverIndex, 1);
            }
            
            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();
            
            if (approvers.length === config.approvalCountNeededForBlanketBan) {
                const blanketBanButton = new ButtonBuilder()
                    .setCustomId(`${BanShareButtonArg.BLANKET_BAN}`)
                    .setLabel('Blanket Banned')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
    
                banshareActionRow.addComponents(blanketBanButton);

                await interaction.message.edit({ components: [banshareActionRow] });
                return;
            }

            const banshareButton = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.BANSHARE} ${userId}`)
                .setLabel('Banshare')
                .setStyle(ButtonStyle.Success)
            const blanketBanButton = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.BLANKET_BAN} ${userId} ${approvers.length} ${approvers.join(' ')}`)
                .setLabel(`Blanket Ban ${approvers.length}/${config.approvalCountNeededForBlanketBan}`)
                .setStyle(ButtonStyle.Success)
            const reject = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.REJECT_MAIN} ${userId}`)
                .setLabel('Reject')
                .setStyle(ButtonStyle.Danger)

            banshareActionRow.addComponents(banshareButton, blanketBanButton, reject);

            await interaction.message.edit({ components: [banshareActionRow] });
            break;
        }
        case BanShareButtonArg.REJECT_MAIN: {
            if (customIdArgs.length !== 1) {
                // TODO: write log
                return;
            }
            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

            const rejectButton = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.REJECT_MAIN}`)
                .setLabel('Rejected')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)

            banshareActionRow.addComponents(rejectButton);

            await interaction.message.edit({ components: [banshareActionRow] });
            break;
        }

        //Network server 
        case BanShareButtonArg.BAN_FROM_SERVER: {
            if (customIdArgs.length !== 1) {
                // TODO: write log
                return;
            }
            const guildChannel = interaction.channel as TextChannel;
            const broadcastWebhookIds = (await databaseManager.getBroadcasts()).map((broadcast) => broadcast.webhookId);
            const webhooks = await guildChannel.fetchWebhooks();
            const webhook = webhooks.find((webhook) => broadcastWebhookIds.includes(webhook.id));
            if (!webhook) {
                logger.warn('No webhook found accepting banshare on network server.');
                return;
            }

            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

            const banButton = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.BAN_FROM_SERVER}`)
                .setLabel('Banned')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)

            banshareActionRow.addComponents(banButton);

            // TODO: ban user
            await webhook.editMessage(interaction.message, { components: [banshareActionRow] });
            break;
        }
        case BanShareButtonArg.REJECT_SUB: {
            if (customIdArgs.length !== 1) {
                // TODO: write log
                return;
            }
            const guildChannel = interaction.channel ? interaction.channel as TextChannel : undefined;
            if (!guildChannel) {
                logger.warn('Could not find guild channel during rejecting sub.');
                return;
            }
            const broadcastWebhookIds = (await databaseManager.getBroadcasts()).map((broadcast) => broadcast.webhookId);
            const webhooks = await guildChannel.fetchWebhooks();
            const webhook = webhooks.find((webhook) => broadcastWebhookIds.includes(webhook.id));
            if (!webhook) {
                logger.warn('No webhook found while rejecting banshare on network server.');
                return;
            }

            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

            const rejectButton = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.REJECT_SUB}`)
                .setLabel('Reject')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)

            banshareActionRow.addComponents(rejectButton);

            await webhook.editMessage(interaction.message, { components: [banshareActionRow] });
            break
        }
            
        //Network  
        case BanShareButtonArg.ACCEPT_REQUEST: {
            if (customIdArgs.length !== 3) {
                // TODO: write log
                return;
            }
            const guildId = customIdArgs[0];
            const channelId = customIdArgs[1];
            const type = customIdArgs[2];
            const guild = client.guilds.cache.find((guild) => guild.id === guildId);
            if (!guild) {
                logger.warn('No guild found while trying to accept a request.')
                return;
            }

            const channel = guild.channels.cache.find((channel) => channel.id === channelId);
            if (!channel) {
                logger.warn('No channel found while trying to accept a request.')
                return;
            }
            
            await joinHandler.acceptNetworkAccessRequest({ guild, channel: channel as TextChannel, type });
        
            const joinHandlerActionRow = new ActionRowBuilder<ButtonBuilder>();
        
            const acceptButton = new ButtonBuilder()
                .setCustomId(interaction.customId)
                .setLabel('Accepted')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
        
            joinHandlerActionRow.addComponents(acceptButton);
        
            await interaction.message.edit({ components: [joinHandlerActionRow] });
            break
        }
        case BanShareButtonArg.REJECT_REQUEST: {
            if (customIdArgs.length !== 3) {
                // TODO: write log
                return;
            }
            const guildId = customIdArgs[0];
            const channelId = customIdArgs[1];
            const type = customIdArgs[2];
            const guild = client.guilds.cache.find((guild) => guild.id === guildId);
            if (!guild) {
                logger.warn('No guild found while trying to accept a request.')
                return;
            }

            const channel = guild.channels.cache.find((channel) => channel.id === channelId);
            if (!channel) {
                logger.warn('No channel found while trying to accept a request.')
                return;
            }
            await joinHandler.rejectNetworkAccessRequest({ guild, channel: channel as TextChannel, type });
            
            const joinHandlerActionRow = new ActionRowBuilder<ButtonBuilder>();
    
            const rejectButton = new ButtonBuilder()
                .setCustomId(interaction.customId)
                .setLabel('Rejected')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
    
            joinHandlerActionRow.addComponents(rejectButton);
    
            await interaction.message.edit({ components: [joinHandlerActionRow] });
            break
        }
        default: {
            logger.warn(`Unsupported button argument provided ${command}`);
        }
    }
})