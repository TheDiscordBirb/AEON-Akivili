import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    Client,
    GuildMember,
    PermissionFlagsBits,
    TextChannel,
    User,
} from "discord.js";
import { banshareManager } from "../../functions/banshare";
import { BanShareButtonArg, BanshareStatus } from "../../types/event";
import { config } from "../../const";
import { databaseManager } from "../../structures/database";
import { permissionHandler } from "../../functions/permission-handler";
import { ErrorNames } from "../../types/error-handler";
import { ButtonIds } from "../../types/buttons";

export const banshareButtons = async (client: Client | undefined, interaction: ButtonInteraction<CacheType>, guildMember: GuildMember): Promise<void> => {
    await interaction.deferUpdate();
    if(!client) throw new Error(ErrorNames.NO_CLIENT_IN_CACHE);
    const permissionCheck = await permissionHandler.checkForPermission(
        guildMember.user,
        { local: true, onlyLocal: true },
        guildMember.guild,
        [PermissionFlagsBits.BanMembers]);
        
    if(!permissionCheck.status) {
        if (!interaction.user.dmChannel) {
            await interaction.user.createDM(true);
        }
        
        await interaction.user.send('You do not have permission to use this.')
        .catch();
        return;
    };
    
    const customIdArgs = interaction.customId.split(' ');
    customIdArgs.splice(0, 1);
    const command = customIdArgs.shift();

    switch (command) {
        //Banshare

        //Main server
        case BanShareButtonArg.BANSHARE: {
            if (customIdArgs.length !== 1) throw new Error(ErrorNames.WRONG_BUTTON_ID);
            const userId = customIdArgs[0];

            if (!interaction.message.embeds[0].description) throw new Error(ErrorNames.NO_BANSHARE_DESCRIPTION);
            const proofStartIndex = interaction.message.embeds[0].description?.indexOf("Proof");
            const reason = interaction.message.embeds[0].description.slice("Reason: ".length, proofStartIndex).trim();

            const proof = interaction.message.embeds[0].description?.slice(proofStartIndex+"Proof:\n".length).split('\n');

            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

            const banshareButton = new ButtonBuilder()
                .setCustomId(`${ButtonIds.BANSHARE} ${BanShareButtonArg.BANSHARE} ${userId}`)
                .setLabel('Banshared')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)

            banshareActionRow.addComponents(banshareButton);

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
            break;
        }
        case BanShareButtonArg.IMPORTANT_BANSHARE: {
            if ((customIdArgs.length < 1) || (customIdArgs.length > 2)) throw new Error(ErrorNames.WRONG_BUTTON_ID);
            const userId = customIdArgs[0];

            const reason = interaction.message.embeds[0].description;
            if (!reason) throw new Error(ErrorNames.NO_BANSHARE_DESCRIPTION);

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
                    .setCustomId(`${ButtonIds.BANSHARE} ${BanShareButtonArg.IMPORTANT_BANSHARE}`)
                    .setLabel(`Banshared ${config.approvalCountNeededForImportantBanshare}/${config.approvalCountNeededForImportantBanshare}`)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
    
                banshareActionRow.addComponents(importantBanshareButton);   

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
                return;
            }

            const banshareButton = new ButtonBuilder()
                .setCustomId(`${ButtonIds.BANSHARE} ${BanShareButtonArg.BANSHARE} ${userId}`)
                .setLabel('Banshare')
                .setStyle(ButtonStyle.Success)
            const importantBanshareButton = new ButtonBuilder()
                .setCustomId(`${ButtonIds.BANSHARE} ${BanShareButtonArg.IMPORTANT_BANSHARE} ${userId} ${approvers.join(':')}`)
                .setLabel(`Important Banshare ${approvers.length}/${config.approvalCountNeededForImportantBanshare}`)
                .setStyle(ButtonStyle.Success)
            const reject = new ButtonBuilder()
                .setCustomId(`${ButtonIds.BANSHARE} ${BanShareButtonArg.REJECT_MAIN} ${userId}`)
                .setLabel('Reject')
                .setStyle(ButtonStyle.Danger)

            banshareActionRow.addComponents(banshareButton, importantBanshareButton, reject);

            await interaction.message.edit({ components: [banshareActionRow] });
            break;
        }
        case BanShareButtonArg.REJECT_MAIN: {
            if (customIdArgs.length !== 1) throw new Error(ErrorNames.WRONG_BUTTON_ID);
            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

            const rejectButton = new ButtonBuilder()
                .setCustomId(`${ButtonIds.BANSHARE} ${BanShareButtonArg.REJECT_MAIN}`)
                .setLabel('Rejected')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)

            banshareActionRow.addComponents(rejectButton);

            await interaction.message.edit({ components: [banshareActionRow] });
            break;
        }

        //Network server 
        case BanShareButtonArg.BAN_FROM_SERVER: {
            if (customIdArgs.length !== 1) throw new Error(ErrorNames.WRONG_BUTTON_ID);

            if(!interaction.guildId) throw new Error(ErrorNames.NO_GUILD_ID);
            
            const guildChannel = interaction.channel ? interaction.channel as TextChannel : undefined;
            if (!guildChannel) throw new Error(ErrorNames.NO_CHANNEL);

            const broadcastRecords = await databaseManager.getBroadcasts();
            const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === guildChannel.id);
            if (!channelWebhook) throw new Error(ErrorNames.NO_WEBHOOK);

            const webhook = await client.fetchWebhook(channelWebhook.webhookId);
            if (!config.nonChatWebhooks.includes(webhook.name)) return;

            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

            const banButton = new ButtonBuilder()
                .setCustomId(`${ButtonIds.BANSHARE} ${BanShareButtonArg.BAN_FROM_SERVER}`)
                .setLabel('Banned')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)

            banshareActionRow.addComponents(banButton);

            await interaction.guild?.bans.create(customIdArgs[0]);
            await databaseManager.updateBanshareStatus(interaction.guildId, customIdArgs[0], BanshareStatus.ENFORCED);
            await webhook.editMessage(interaction.message, { components: [banshareActionRow] });
            break;
        }
        case BanShareButtonArg.REJECT_SUB: {
            if (customIdArgs.length !== 1) throw new Error(ErrorNames.WRONG_BUTTON_ID);

            if(!interaction.guildId) throw new Error(ErrorNames.NO_GUILD_ID);
            
            const guildChannel = interaction.channel ? interaction.channel as TextChannel : undefined;
            if (!guildChannel) throw new Error(ErrorNames.NO_CHANNEL);

            const broadcastRecords = await databaseManager.getBroadcasts();
            const channelWebhook = broadcastRecords.find((broadcast) => broadcast.channelId === guildChannel.id);
            if (!channelWebhook) throw new Error(ErrorNames.NO_WEBHOOK);

            const webhook = await client.fetchWebhook(channelWebhook.webhookId);
            if (!config.nonChatWebhooks.includes(webhook.name)) return;

            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

            const rejectButton = new ButtonBuilder()
                .setCustomId(`${ButtonIds.BANSHARE} ${BanShareButtonArg.REJECT_SUB}`)
                .setLabel('Rejected')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)

            banshareActionRow.addComponents(rejectButton);

            await databaseManager.updateBanshareStatus(interaction.guildId, customIdArgs[0], BanshareStatus.ENFORCED);
            await webhook.editMessage(interaction.message, { components: [banshareActionRow] });
            break
        }
        default: {
            return;
        }
    }
}
