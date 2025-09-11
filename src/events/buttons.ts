import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    GuildMember,
    TextChannel,
    ButtonComponent,
    BaseGuildTextChannel,
    WebhookClient,
    User,
    ButtonInteraction,
    CacheType,
    ActionRowComponent,
    MessageActionRowComponent,
    ActionRow
} from "discord.js";
import { banshareManager } from "../functions/banshare";
import { Event } from "../structures/event";
import { hasModerationRights, rebuildMessageComponentAfterUserInteraction } from "../utils";
import { client } from "../structures/client";
import { joinHandler } from "../functions/join-handler";
import { Logger } from "../logger";
import { BanShareButtonArg, DmMessageButtonArg } from "../types/event";
import { config } from "../const";
import { databaseManager } from "../structures/database";
import { ChannelType } from "discord.js";
import { MessagesRecord } from "../types/database";
import { modmailHandler } from "../functions/modmail";

const logger = new Logger("Buttons");

export default new Event("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    await interaction.deferUpdate();
    const buttonComponent = (interaction.component as ButtonComponent);
    if(!buttonComponent) {
        logger.warn("Could not get button component.");
        await errorButtonFunction(interaction);
        return;
    }
    const buttonCustomId = buttonComponent.customId;
    if (!buttonCustomId) {
        logger.warn("Could not get button custom id.");
        await errorButtonFunction(interaction);
        return;
    }
    if (!interaction.channel) {
        logger.wtf("No button interaction channel.")
        return;
    }

    if (interaction.channel.type === ChannelType.DM) {
        await dmButtonFunction(interaction);
        return;
    }

    let guildMember
    try {
        guildMember = await checkForGuildMember(interaction);
    } catch (error) {
        logger.error("Error:", (error as Error));
        return;
    }

    const customEmojiRegex = new RegExp(/.*:[0-9]*/gm);
    const standardEmojiRegex = new RegExp(/%[A-Z0-9][A-Z0-9]/gm);

    if (!!buttonCustomId.match(customEmojiRegex) || !!buttonCustomId.match(standardEmojiRegex)) {
        await emojiButtonFunction(interaction);
        return;
    }

    await moderationButtonFunction(interaction, guildMember);
})

const errorButtonFunction = async (interaction: ButtonInteraction<CacheType>): Promise<void> => {
    logger.warn(`Error button function executed, message server: ${interaction.message.guild} | channel: ${interaction.message.channel}`);
    const errorButton = new ButtonBuilder()
        .setCustomId("Error")
        .setDisabled(true)
        .setLabel("Error")
        .setStyle(ButtonStyle.Danger);
    const errorRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(errorButton);
    
    interaction.message.edit({ components: [errorRow] });
    return;
}

const dmButtonFunction = async (interaction: ButtonInteraction<CacheType>): Promise<void> => {
    const customIdArgs = interaction.customId.split(' ');
    const command = customIdArgs.shift();

    switch (command) {
        // Dm banshare buttons
        case DmMessageButtonArg.NEW_BANSHARE: 
            await banshareManager.dmBanshareFunction(customIdArgs[0], undefined, interaction);
            break;

        // Dm modmail buttons
        case DmMessageButtonArg.OPEN_MODMAIL: {
            await modmailHandler.startModmail(interaction);
            const message = interaction.channel?.messages.cache.get(customIdArgs[1]);
            if(!message) {
                logger.warn("Could not find first message.");
                return;
            }
            await modmailHandler.forwardModmailMessage(message);
            break;
        }

        case DmMessageButtonArg.CLOSE_MODMAIL: {
            const modmail = await databaseManager.getModmailByUserId(interaction.user.id);
            await modmailHandler.closeModmail(modmail.channelId);
            break;
        }
    }
}

const checkForGuildMember = async (interaction: ButtonInteraction<CacheType>): Promise<GuildMember> => {
    const interactionMember = interaction.member;
    if (interactionMember ? interactionMember as GuildMember : undefined) {
        return interactionMember as GuildMember;
    }
    throw new Error("Could not get guild member from button press.");
}

const emojiButtonFunction = async (interaction: ButtonInteraction<CacheType>): Promise<void> => {
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
    const newActionRows = await rebuildMessageComponentAfterUserInteraction(interaction.message, interaction.message.components as ActionRow<MessageActionRowComponent>[], { userId, userMessageId, reactionIdentifier }, (interaction.user.id === client.user?.id ? true : false));

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
        await webhookClient.editMessage(message, { components: [...newActionRows[newActionRows.indexOf(newActionRows.find((actionRow) => actionRow.guildID === broadcastRecord.guildId) || newActionRows[0])].components] });
    }))
    await interaction.editReply({ components: [...newActionRows[0].components] });
}

const moderationButtonFunction = async (interaction: ButtonInteraction<CacheType>, guildMember: GuildMember): Promise<void> => {
    if (!hasModerationRights(guildMember)) {
        if (!interaction.user.dmChannel) {
            await interaction.user.createDM(true);
        }
        
        interaction.user.send('You do not have permission to use this.')
        .catch();
        return;
    };
    
    const customIdArgs = interaction.customId.split(' ');
    const command = customIdArgs.shift();

    switch (command) {
        //Modmail
        case DmMessageButtonArg.CLOSE_MODMAIL: {
            const modmail = await databaseManager.getModmail(interaction.channelId);
            await modmailHandler.closeModmail(modmail.channelId);
        }

        //Banshare

        //Main server
        case BanShareButtonArg.BANSHARE: {
            if (customIdArgs.length !== 1) {
                logger.warn(`Got wrong amount of arguments for ${BanShareButtonArg.BANSHARE}`);
                return;
            }
            const userId = customIdArgs[0];

            const reason = interaction.message.embeds[0].description;
            if (!reason) {
                await errorButtonFunction(interaction);
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
                const tempBanServer = client.guilds.cache.get(config.tempBanshareServerId);
                    await tempBanServer?.bans.create(userId)
                    .then(async (guildBan) => {
                        if(typeof(guildBan) != "string") {
                            guildBan = (guildBan as User);
                        }
                        await banshareManager.shareBanshare({user: guildBan, reason, proof});
                        await tempBanServer.bans.remove(guildBan);
                    })
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

            const reason = interaction.message.embeds[0].description;
            if (!reason) {
                await errorButtonFunction(interaction);
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
                    const tempBanServer = client.guilds.cache.get(config.tempBanshareServerId);
                    await tempBanServer?.bans.create(userId)
                    .then(async (guildBan) => {
                        if(typeof(guildBan) != "string") {
                            guildBan = (guildBan as User);
                        }
                        await banshareManager.shareBanshare({user: guildBan, reason, proof}, true);
                        await tempBanServer.bans.remove(guildBan);
                    })
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

            try {
                await interaction.guild?.bans.create(customIdArgs[0]);
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
            try {
                await joinHandler.acceptNetworkAccessRequest({ guild, channel: channel as TextChannel, type, user: client.users.cache.get(interaction.message.embeds[0].description?.split(/ +/)[interaction.message.embeds[0].description?.split(/ +/).length - 1] ?? interaction.user.id) ?? interaction.user });
            } catch (error) {
                logger.error(`There was an error gaining network access.`, (error as Error));
                await errorButtonFunction(interaction);
                return;
            }
        
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
            try {
                await joinHandler.rejectNetworkAccessRequest({ guild, channel: channel as TextChannel, type, user: client.users.cache.get(interaction.message.embeds[0].description?.split(/ +/)[interaction.message.embeds[0].description?.split(/ +/).length - 1] ?? interaction.user.id) ?? interaction.user });
            } catch (error) {
                logger.error(`There was an error refusing network access.`, (error as Error));
                await errorButtonFunction(interaction);
                return;
            }
            
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
}