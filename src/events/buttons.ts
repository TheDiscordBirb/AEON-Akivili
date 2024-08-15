import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    GuildMember,
    TextChannel,
    ButtonComponent,
    BaseGuildTextChannel,
    WebhookClient,
    User
} from "discord.js";
import { banshareManager } from "../functions/banshare";
import { Event } from "../structures/event";
import { hasModerationRights, rebuildMessageComponentAfterUserInteraction } from "../utils";
import { client } from "../structures/client";
import { joinHandler } from "../functions/join-handler";
import { Logger } from "../logger";
import { BanShareButtonArg } from "../types/event";
import { config } from "../const";
import { databaseManager } from "../structures/database";
import { ChannelType } from "discord.js";
import { MessagesRecord } from "../types/database";

const logger = new Logger("Buttons");

export default new Event("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    await interaction.deferUpdate();
    const guildMember = interaction.member ? interaction.member as GuildMember : null;

    if (!guildMember) {
        logger.wtf("Interaction's creator does not exist.");
        return;
    }

    const customEmojiRegex = new RegExp(/.*:[0-9]*/gm);
    const standardEmojiRegex = new RegExp(/%[A-Z0-9][A-Z0-9]/gm);
    const buttonComponent = (interaction.component as ButtonComponent);

    if (!!buttonComponent.customId?.match(customEmojiRegex) || !!buttonComponent.customId?.match(standardEmojiRegex)) {
        let userMessageId: string;
        try {
            userMessageId = await databaseManager.getMessageUid(interaction.channelId, interaction.message.id);
        } catch (error) {
            logger.error(`Could not get messages. Error: `, error as Error);
            return;
        }
        
        const userId = interaction.user.id;
        const reactionIdentifier = (interaction.component as ButtonComponent).customId;
        if (!userMessageId) {
            logger.warn(`No user message id`);
            return;
        }   
        if (!userId) {
            logger.warn(`No user id`);
            return;
        }
        if (!reactionIdentifier) {
            logger.warn(`No reaction identifier`);
            return;
        }

        const channel = interaction.message.channel as BaseGuildTextChannel;
        if (channel.type !== ChannelType.GuildText) return;
        
        const broadcastRecords = await databaseManager.getBroadcasts();
        const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === channel.id);
        if (!channelWebhook) return;

        let webhook;
        try {
            webhook = await client.fetchWebhook(channelWebhook.webhookId);
        } catch (error) { 
            logger.error(`Could not fetch webhook in guild: ${interaction.guild?.name ?? 'Unknown'} channel: ${channel.name ?? 'Unknown'}`, error as Error)
            return;
        };
        
        if (config.nonChatWebhooks.includes(webhook.name)) return;
        
        const webhookNameParts = webhook.name.split(' ');
        const webhookChannelType = webhookNameParts[webhookNameParts.length - 1];
        const matchingBroadcastRecords = broadcastRecords.filter((broadcastRecord) => broadcastRecord.channelType === webhookChannelType);
        const actionRows = await rebuildMessageComponentAfterUserInteraction(interaction.message.components, { userId, userMessageId, reactionIdentifier }, (interaction.user.id === client.user?.id ? true : false));

        await Promise.allSettled(matchingBroadcastRecords.map(async (broadcastRecord) => {
            const webhookClient = new WebhookClient({ id: broadcastRecord.webhookId, token: broadcastRecord.webhookToken });
            let messagesOnNetwork: MessagesRecord[];
            try {
                messagesOnNetwork = await databaseManager.getMessages(interaction.message.channel.id, interaction.message.id);
            } catch (error) {
                logger.error(`Could not get messages. Error: `, error as Error);
                return;
            }
            const correctMessageOnNetwork = messagesOnNetwork.find((messageOnNetwork) => messageOnNetwork.channelId === broadcastRecord.channelId);
            if (!correctMessageOnNetwork) {
                logger.warn(`Could not get correct message on network`);
                return;
            }
            
            const channel = client.channels.cache.find((ch) => ch.id === correctMessageOnNetwork.channelId) as TextChannel;
            const message = await channel.messages.fetch({ message: correctMessageOnNetwork.channelMessageId });
            if (!message.components) {
                logger.warn(`No message components, message id: ${message.id}`)
                return;
            }
            await webhookClient.editMessage(message, { components: [...actionRows] });
        }))
        await interaction.editReply({ components: [...actionRows] });
        return;
    }

    if (!hasModerationRights(guildMember)) {
        if (!interaction.user.dmChannel) {
            await interaction.user.createDM(true);
        }
        
        interaction.user.send('You do not have permission to use this.')
        .catch();
        return;
    };
    const customIdArgs = interaction.customId.split(' ');

    if (!customIdArgs.length) {
        logger.warn(`No custom id`);
        return;
    }
    const command = customIdArgs.shift();
    switch (command) {
        //Banshare

        //Main server
        case BanShareButtonArg.BANSHARE: {
            if (customIdArgs.length !== 1) {
                logger.warn(`Got wrong amount of arguments for ${BanShareButtonArg.BANSHARE}`);
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
        case BanShareButtonArg.IMPORTANT_BANSHARE: {
            if ((customIdArgs.length < 1) || (customIdArgs.length > 2)) {
                logger.warn(`Got wrong amount of arguments for ${BanShareButtonArg.IMPORTANT_BANSHARE}`);
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
            const currentApprover = interaction.user;
            const approvers = customIdArgs[1] ? customIdArgs[1].split(':') : [];

            const currentApproverIndex = approvers.findIndex((approver) => approver === currentApprover.id);
            if (currentApproverIndex === -1) {
                approvers.push(currentApprover.id);
            } else {
                approvers.splice(currentApproverIndex, 1);
            }
            
            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();
            
            if (approvers.length === config.approvalCountNeededForImportantBanshare) {
                const importantBanshareButton = new ButtonBuilder()
                    .setCustomId(`${BanShareButtonArg.IMPORTANT_BANSHARE}`)
                    .setLabel(`Banshared ${config.approvalCountNeededForImportantBanshare}/${config.approvalCountNeededForImportantBanshare}`)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
    
                banshareActionRow.addComponents(importantBanshareButton);   

                try {
                    await interaction.message.edit({ components: [banshareActionRow] });
                    await banshareManager.shareBanshare({ user, reason, proof }, true);
                } catch (error) {
                    logger.error('Failed to edit buttons/send banshare.',error as Error);
                }
                return;
            }

            const banshareButton = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.BANSHARE} ${userId}`)
                .setLabel('Banshare')
                .setStyle(ButtonStyle.Success)
            const importantBanshareButton = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.IMPORTANT_BANSHARE} ${userId} ${approvers.join(':')}`)
                .setLabel(`Important Banshare ${approvers.length}/${config.approvalCountNeededForImportantBanshare}`)
                .setStyle(ButtonStyle.Success)
            const reject = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.REJECT_MAIN} ${userId}`)
                .setLabel('Reject')
                .setStyle(ButtonStyle.Danger)

            banshareActionRow.addComponents(banshareButton, importantBanshareButton, reject);

            await interaction.message.edit({ components: [banshareActionRow] });
            break;
        }
        case BanShareButtonArg.REJECT_MAIN: {
            if (customIdArgs.length !== 1) {
                logger.warn(`Got wrong amount of arguments for ${BanShareButtonArg.REJECT_MAIN}`);
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
                logger.warn(`Got wrong amount of arguments for ${BanShareButtonArg.BAN_FROM_SERVER}`);
                return;
            }
            const guildChannel = interaction.channel ? interaction.channel as TextChannel : undefined;
            if (!guildChannel) {
                logger.warn('Could not find guild channel during rejecting sub.');
                return;
            }

            const broadcastRecords = await databaseManager.getBroadcasts();
            const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === guildChannel.id);
            if (!channelWebhook) {
                logger.warn(`Couldnt get webhook.`);
                return;
            }

            let webhook;
            try {
                webhook = await client.fetchWebhook(channelWebhook.webhookId);
            } catch (error) { 
                logger.error(`Could not fetch webhook in guild: ${interaction.guild?.name ?? 'Unknown'} channel: ${guildChannel.name ?? 'Unknown'}`, error as Error)
                return;
            };
            
            if (!config.nonChatWebhooks.includes(webhook.name)) return;

            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

            const banButton = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.BAN_FROM_SERVER}`)
                .setLabel('Banned')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)

            banshareActionRow.addComponents(banButton);

            const user = client.users.cache.get(customIdArgs[0]);
            if (!user) {
                (interaction.member?.user as User).dmChannel ? await (interaction.member?.user as User).send(`Could not find user`) : (await (interaction.member?.user as User).createDM()).send(`Could not find user, please contact birb`)
                logger.warn(`Could not get user.`);
                return;
            }
            try {
                await interaction.guild?.bans.create(user)
                await webhook.editMessage(interaction.message, { components: [banshareActionRow] });
            } catch (error) {
                (interaction.member?.user as User).dmChannel ? await (interaction.member?.user as User).send(`Could not execute ban, please contact birb`) : (await (interaction.member?.user as User).createDM()).send(`Could not execute ban, please contact birb`)
                logger.error(`Could not ban user`, (error as Error));
            }
            break;
        }
        case BanShareButtonArg.REJECT_SUB: {
            if (customIdArgs.length !== 1) {
                logger.warn(`Got wrong amount of arguments for ${BanShareButtonArg.REJECT_SUB}`);
                return;
            }
            const guildChannel = interaction.channel ? interaction.channel as TextChannel : undefined;
            if (!guildChannel) {
                logger.warn('Could not find guild channel during rejecting sub.');
                return;
            }

            const broadcastRecords = await databaseManager.getBroadcasts();
            const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === guildChannel.id);
            if (!channelWebhook) return;

            let webhook;
            try {
                webhook = await client.fetchWebhook(channelWebhook.webhookId);
            } catch (error) { 
                logger.error(`Could not fetch webhook in guild: ${interaction.guild?.name ?? 'Unknown'} channel: ${guildChannel.name ?? 'Unknown'}`, error as Error)
                return;
            };
            
            if (!config.nonChatWebhooks.includes(webhook.name)) return;

            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

            const rejectButton = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.REJECT_SUB}`)
                .setLabel('Rejected')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)

            banshareActionRow.addComponents(rejectButton);

            await webhook.editMessage(interaction.message, { components: [banshareActionRow] });
            break
        }
            
        //Network  
        case BanShareButtonArg.ACCEPT_REQUEST: {
            if (customIdArgs.length !== 3) {
                logger.warn(`Got wrong amount of arguments for ${BanShareButtonArg.ACCEPT_REQUEST}`);
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
                logger.warn(`Got wrong amount of arguments for ${BanShareButtonArg.REJECT_REQUEST}`);
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
            return;
        }
    }
})