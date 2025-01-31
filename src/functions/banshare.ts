import {
    Client,
    EmbedBuilder,
    Guild,
    User,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    WebhookClient,
    TextChannel,
    Colors,
    ButtonInteraction,
    CacheType,
    GuildMember,
    DMChannel
} from "discord.js";
import { BanshareData } from "../types/database";
import { config } from "../const";
import { databaseManager } from "../structures/database";
import { BanShareButtonArg, BanshareStatus, DmMessageButtonArg } from "../types/event";
import { client } from "../structures/client";
import { Logger } from "../logger";
import { AutoBanLevelOptions, RunOptions } from "../types/command";
import { Time } from "../utils";

const logger = new Logger("Banshare");

class BanshareManager {
    public async requestBanshare(data: BanshareData, client: Client, submitter: User, guildOfOrigin: Guild) {
        const mainChannel = client.channels.cache.get(config.aeonBanshareChannelId);
        if (!mainChannel) {
            logger.warn(`Could not get main channel`);
            return;
        }
        let dataUsername: string, dataDisplayName: string, dataUserId: string;
        if (typeof (data.user) === "string") {
            dataUsername = dataUserId = dataDisplayName = data.user;
        } else {
            dataUsername = data.user.username;
            dataUserId = data.user.id;
            dataDisplayName = data.user.displayName;
        }

        let proofMessage = "";
        data.proof.forEach((proof) => {
            proofMessage += `${proof}\n`;
        })

        const banshareRequestEmbed = new EmbedBuilder()
            .setAuthor({ name: `${submitter.displayName} | ${guildOfOrigin.name}`, iconURL: submitter.displayAvatarURL() })
            .setTitle(`**Banshare request for ${dataUsername} | ${dataDisplayName}**`)
            .setDescription(`Reason: ${data.reason}\n\nProof:\n${proofMessage}`)
            .setURL(`https://discord.com/users/${dataUserId}`);
        
            
        const embeds: EmbedBuilder[] = [];
        
        embeds.push(banshareRequestEmbed);
        
        
        
        
        const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

        const banshareButton = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.BANSHARE} ${dataUserId}`)
            .setLabel('Banshare')
            .setStyle(ButtonStyle.Success)
        const importantBanshareButton = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.IMPORTANT_BANSHARE} ${dataUserId}`)
            .setLabel(`Important Banshare 0/${config.approvalCountNeededForImportantBanshare}`)
            .setStyle(ButtonStyle.Success)
        const reject = new ButtonBuilder()
            .setCustomId(`${BanShareButtonArg.REJECT_MAIN} ${dataUserId}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
        
        banshareActionRow.addComponents(banshareButton, importantBanshareButton, reject);
        
        await (mainChannel as TextChannel).send({ content: proofMessage, embeds, components: [banshareActionRow] });
    }

    public async shareBanshare(data: BanshareData, importantBansharePing = false) {
        let dataUsername: string, dataUserId: string;
        if (typeof (data.user) === "string") {
            dataUsername = dataUserId = data.user;
        } else {
            dataUsername = data.user.username;
            dataUserId = data.user.id;
        }
        
        const embeds: EmbedBuilder[] = [];

        let proofMessage = "";
        data.proof.forEach((proof) => {
            proofMessage += `${proof}\n`;
        })
        const banshareRequestEmbed = new EmbedBuilder()
            .setTitle(`**Banshare for ${dataUsername} | ${dataUserId}**`)
            .setDescription(`${data.reason}\n\nProof:\n${proofMessage}`)
            .setURL(`https://discord.com/users/${dataUserId}`);
        
        embeds.push(banshareRequestEmbed);
        

        const broadcasts = await databaseManager.getBroadcasts();
        const autoBannedContent = 'This user has been automatically banned';

        const webhookMessages = broadcasts.map(async (broadcast) => {
            if (broadcast.channelType !== 'Banshare') return;
            const banshareActionRow = new ActionRowBuilder<ButtonBuilder>();

            const banFromServerButton = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.BAN_FROM_SERVER} ${dataUserId}`)
                .setLabel('Ban')
                .setStyle(ButtonStyle.Success)
            const reject = new ButtonBuilder()
                .setCustomId(`${BanShareButtonArg.REJECT_SUB} ${dataUserId}`)
                .setLabel('Reject')
                .setStyle(ButtonStyle.Danger)
            
            banshareActionRow.addComponents(banFromServerButton, reject);

            let banshareContent;
            if (broadcast.autoBanLevel >= parseInt(AutoBanLevelOptions.ALL)) {
                banshareContent = autoBannedContent;

                const autoBanned = new ButtonBuilder()
                    .setCustomId(`Autoban ${dataUserId}`)
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
                        .setCustomId(`Autoban ${dataUserId}`)
                        .setLabel('Auto banned')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)

                    banshareActionRow.setComponents(autoBanned);
                }
            }

            await databaseManager.registerBanshare({serverId: broadcast.guildId, status: BanshareStatus.PENDING, userId: dataUserId, reason: data.reason, proof: proofMessage, timestamp: Date.now()});
            const webhookClient = new WebhookClient({ id: broadcast.webhookId, token: broadcast.webhookToken });
            return {
                webhookClient,
                data: { content: `${banshareContent ? proofMessage + banshareContent : proofMessage}`, embeds, components: [banshareActionRow] },
                serverId: broadcast.guildId,
                userId: dataUserId
            }
        });

        await Promise.allSettled(webhookMessages.map(async (webhookMessage) => {
            const awaitedWebhookMessage = await webhookMessage;
            if (!awaitedWebhookMessage) return;
            awaitedWebhookMessage.webhookClient.send(awaitedWebhookMessage.data)
                .then(async (message) => {
                    if (message.content === autoBannedContent) {
                        if (!message.components) {
                            logger.warn(`Couldnt get message components`);
                            return;
                        }
                        const broadcasts = await databaseManager.getBroadcasts();
                        const correctBroadcast = broadcasts.find((broadcast) => broadcast.webhookId === awaitedWebhookMessage.webhookClient.id);
                        if (!correctBroadcast) return;
                        const guild = client.guilds.cache.get(correctBroadcast.guildId);
                        if (!guild) return;
                        await guild.bans.create(dataUserId);
                        await databaseManager.updateBanshareStatus(awaitedWebhookMessage.serverId, awaitedWebhookMessage.userId, BanshareStatus.ENFORCED);
                    }
                });
        }))
    }
    
    public async dmBanshareFunction(guildId: string, options?: RunOptions, interaction?: ButtonInteraction<CacheType>) {
        let interactionMember: GuildMember;
        try {
            let proof = true;
            const guild = client.guilds.cache.get(guildId);
            if (!guild) throw new Error("Could not get valid server id.");

            if (options) {
                interactionMember = options.interaction.member;
            } else if (interaction) {
                const buttonInteractionMember = interaction.user;
                if (!buttonInteractionMember) {
                    throw new Error("No button interaction user");
                }

                const guildMember = guild.members.cache.get(buttonInteractionMember.id);
                if (!guildMember) {
                    throw new Error("User is not in the server the command was originally used in");
                }
                interactionMember = guildMember;
                
                await interaction.message.delete();
            } else {
                throw new Error("Didnt get slash command options or button interaction.");
            }
            config.activeBanshareFuncionUserIds.push(interactionMember.id);
            
            await (interactionMember.user as User).createDM();
            const dmBanshareEmbed = new EmbedBuilder()
                .setAuthor({ name: client.user?.username ?? "Akivili", iconURL: client.user?.avatarURL() ?? undefined })
                .setColor(Colors.DarkGold)
                .setTitle("Banshare request process started.")
                .setDescription("Please input the id of a single user id:")

            const data: BanshareData = { user: "", reason: "", proof: [] }
            const message = await (interactionMember.user as User).send({ embeds: [dmBanshareEmbed] });
            await (message.channel as DMChannel).awaitMessages({ max: 1, time: Time.minutes(5) }).then(async (userIdMessage) => {
                const firstUserIdMessage = userIdMessage.first();
                if (!firstUserIdMessage) {
                    // TODO: write log
                    if(config.activeBanshareFuncionUserIds.find(e => e === interactionMember.id)) {
                        config.activeBanshareFuncionUserIds.splice(config.activeBanshareFuncionUserIds.indexOf(interactionMember.id), 1);
                    }
                    return;
                }
                const targetUser = client.users.cache.get(firstUserIdMessage.content);
                data.user = targetUser ?? firstUserIdMessage.content;
                
                dmBanshareEmbed.setTitle("Banshare request process in progress.");
                dmBanshareEmbed.setDescription("Please provide reason:");
                await message.edit({ embeds: [dmBanshareEmbed] }).then(async () => {
                    await (message.channel as DMChannel).awaitMessages({ max: 1, time: Time.minutes(5) }).then(async (reasonMessage) => {
                        const firstReasonMessage = reasonMessage.first();
                        if (!firstReasonMessage) {
                            // TODO: write log
                            if(config.activeBanshareFuncionUserIds.find(e => e === interactionMember.id)) {
                                config.activeBanshareFuncionUserIds.splice(config.activeBanshareFuncionUserIds.indexOf(interactionMember.id), 1);
                            }
                            return;
                        }
                        data.reason = firstReasonMessage.content;
                    }).catch(async () => {
                        await interactionMember.user.send("Did not get a response in 5 minutes, aborting.");
                        if(config.activeBanshareFuncionUserIds.find(e => e === interactionMember.id)) {
                            config.activeBanshareFuncionUserIds.splice(config.activeBanshareFuncionUserIds.indexOf(interactionMember.id), 1);
                        }
                        return;
                    });
    
                    dmBanshareEmbed.setDescription("Please provide proof:\n" +
                        "Accepted formats are files and links with full address like: https://www.youtube.com/watch?v=dQw4w9WgXcQ");
                    await message.edit({ embeds: [dmBanshareEmbed] }).then(async () => {
                        await (message.channel as DMChannel).awaitMessages({ max: 1, time: Time.minutes(5) }).then(async (proofMessage) => {
                            const proofMessageFirst = proofMessage.first();
                            if(!proofMessageFirst) throw new Error("Didnt get any valid proof");
                            const proofMessageArgs = proofMessageFirst.content.split(/ +/);
                            if(!proofMessageArgs && !proofMessageFirst.attachments.size) throw new Error("Didnt get any valid proof");
                            const webImageRegex = new RegExp(/(http(s?):)([/|.|\w|\s|-]).*/g);
                            proofMessageArgs.forEach((arg) => {
                                if (arg.match(webImageRegex)) data.proof.push(arg);
                            })
                            proofMessageFirst.attachments.forEach((attachment) => {
                                data.proof.push(attachment.url);
                            })
                            try {
                                if (!data.proof.length) throw new Error("Didnt get any valid proof");
                            } catch (error) {
                                await interactionMember.user.send((error as Error).message);
                                proof = false;
                            }
                        }).catch(async (exception) => {
                            await interactionMember.user.send("Did not get a response in 5 minutes, aborting.");
                            if(config.activeBanshareFuncionUserIds.find(e => e === interactionMember.id)) {
                                config.activeBanshareFuncionUserIds.splice(config.activeBanshareFuncionUserIds.indexOf(interactionMember.id), 1);
                            }
                            return;
                        });
                    })
                });
                
                dmBanshareEmbed.setTitle("Banshare request process ended.");
                dmBanshareEmbed.setDescription("Click the button to submit another banshare.");
                const newBanshareButton = new ButtonBuilder()
                    .setCustomId(`${DmMessageButtonArg.NEW_BANSHARE} ${guild.id}`)
                    .setLabel('New Banshare')
                    .setStyle(ButtonStyle.Danger)
                
                const banshareButtonRow = new ActionRowBuilder<ButtonBuilder>();
                banshareButtonRow.addComponents(newBanshareButton);

                await message.edit({ embeds: [dmBanshareEmbed], components: [banshareButtonRow] });

            }).catch(async () => {
                await interactionMember.user.send("Did not get a response in 5 minutes, aborting.");
                if(config.activeBanshareFuncionUserIds.find(e => e === interactionMember.id)) {
                    config.activeBanshareFuncionUserIds.splice(config.activeBanshareFuncionUserIds.indexOf(interactionMember.id), 1);
                }
                return;
            });

            try {
                if (!proof) {
                    if(config.activeBanshareFuncionUserIds.find(e => e === interactionMember.id)) {
                        config.activeBanshareFuncionUserIds.splice(config.activeBanshareFuncionUserIds.indexOf(interactionMember.id), 1);
                    }
                    return;
                }
                await banshareManager.requestBanshare(data, client, interactionMember.user, guild);
            } catch (error) {
                logger.error('Could not send banshare', error as Error);
                dmBanshareEmbed.setTitle("There was an error with the banshare");
                dmBanshareEmbed.setDescription(`${error as Error}`);

                await message.edit({ embeds: [dmBanshareEmbed], components: [] });
                if(config.activeBanshareFuncionUserIds.find(e => e === interactionMember.id)) {
                    config.activeBanshareFuncionUserIds.splice(config.activeBanshareFuncionUserIds.indexOf(interactionMember.id), 1);
                }
                return;
            }
        } catch (error) {
            logger.error("There was an error during the banshare process.", (error as Error));
            const interactionUser = options?.interaction.member.user ?? interaction?.user ?? undefined;
            if(!interactionUser) return;
            if(config.activeBanshareFuncionUserIds.find(e => e === interactionUser.id)) {
                config.activeBanshareFuncionUserIds.splice(config.activeBanshareFuncionUserIds.indexOf(interactionUser.id), 1);
            }
            return;
        }
        if(config.activeBanshareFuncionUserIds.find(e => e === interactionMember.id)) {
            config.activeBanshareFuncionUserIds.splice(config.activeBanshareFuncionUserIds.indexOf(interactionMember.id), 1);
        }
    }
}

export const banshareManager = new BanshareManager();