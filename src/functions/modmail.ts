import { 
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    CategoryChannel,
    ChannelType,
    Colors,
    EmbedBuilder,
    GuildTextBasedChannel,
    Message,
} from "discord.js";
import { Logger } from "../logger";
import { DmMessageButtonArg } from "../types/event";
import * as dhtml from "discord-html-transcripts";
import { RunOptions } from "../types/command";
import { databaseManager } from "../structures/database";
import { client } from "../structures/client";
import { config } from "../const";
import { Time } from "../utils";

const logger = new Logger("ModmailHandler");

class ModmailHandler {
    public async startModmail(interaction: ButtonInteraction<CacheType>): Promise<void> {
        const modmailEmbed = new EmbedBuilder()
            .setTitle("Modmail opened")
            .setDescription("AEON Navigators will be with you shortly, please be patient.")
            .setColor(Colors.DarkGold)

        const modmailActionRow = new ActionRowBuilder<ButtonBuilder>();
        const closeModmailButton = new ButtonBuilder()
            .setStyle(ButtonStyle.Danger)
            .setCustomId(DmMessageButtonArg.CLOSE_MODMAIL)
            .setLabel("Close Modmail");
        modmailActionRow.addComponents(closeModmailButton);
        try {
            await interaction.message.edit({embeds: [modmailEmbed], components: [modmailActionRow]});
            
            const modmailCatergory = client.channels.cache.get(config.modmailCategoryChannelId);
            if(!modmailCatergory) {
                logger.warn("Could not find modmail category.");
                return;
            }
            const modmailChannel = await (modmailCatergory as CategoryChannel).children.create({ name: `${interaction.user.username}`, type: ChannelType.GuildText })
            await databaseManager.createModmail(interaction.user.id, modmailChannel.id);

            const modmailNotificationEmbed = new EmbedBuilder()
                .setTitle(`Modmail opened.`)
                .setDescription(`${interaction.user} has opened a modmail.`)
                .setColor(Colors.DarkGold)

            await modmailChannel.send({embeds: [modmailNotificationEmbed], components: [modmailActionRow]});
        } catch(error) {
            logger.error("Could not open modmail.", error as Error);
            await (interaction.message.channel as GuildTextBasedChannel).send((error as Error).message);
        }
    }

    public async forwardModmailMessage(interaction?: Message<boolean>, options?: RunOptions): Promise<void> {
        const messageEmbed = new EmbedBuilder()
            .setColor(Colors.DarkGold);
        if(interaction) {
            messageEmbed.setAuthor({ name: interaction.author.username, iconURL: interaction.author.avatarURL() ?? undefined });
            if(interaction.content) {
                messageEmbed.setDescription(interaction.content);
            } else {
                messageEmbed.setDescription(`"No message content."`);
            }
            messageEmbed.setFooter({text: `${interaction.author.id} | ${new Date(Date.now()).toLocaleString('en-US',{ hourCycle: "h12" })}`});
            try {
                const modmail = await databaseManager.getModmailByUserId(interaction.author.id);
                const modmailChannel = client.channels.cache.get(modmail.channelId);
                if(!modmailChannel) {
                    await interaction.reply("Could not locate modmail channel, please contact Birb directly.");
                    return;
                }
                await (modmailChannel as GuildTextBasedChannel).send({embeds: [messageEmbed], files: [...interaction.attachments.values()]});
                await interaction.react("✅");
            } catch(error) {
                logger.error("Could not send modmail message.", (error as Error));
                return;
            }
        } else if (options) {
            messageEmbed.setAuthor({ name: options.interaction.user.username, iconURL: options.interaction.user.avatarURL() ?? undefined });
            messageEmbed.setDescription(options.args.getString("message"));
            messageEmbed.setFooter({ text: `${options.interaction.user.id} | ${new Date(Date.now()).toLocaleString('en-US',{ hourCycle: "h12" })}` });
            try {
                const modmail = await databaseManager.getModmail(options.interaction.channelId);
                const modmailUser = client.users.cache.get(modmail.userId);
                if(!modmailUser) {
                    await options.interaction.reply("Could not send message to this user.");
                    return;
                }
                await modmailUser.send({ embeds: [messageEmbed] });
                await options.interaction.reply({ content: "Message sent.", ephemeral: true });
                await (options.interaction.channel as GuildTextBasedChannel).send({ embeds: [messageEmbed] });
            } catch (error) {
                logger.error("Could not message modmail user.", (error as Error));
                return;
            }
        } else {
            throw new Error("Didnt get interaction or options.");
        }
    }

    public async closeModmail(channelId: string): Promise<void> {
        const channel = client.channels.cache.get(channelId);
        if(!channel) {
            logger.warn("Could not close modmail, no modmail channel.");
            return;
        }
        const logs = await this.generateLogs(channel as GuildTextBasedChannel);
        if(!logs.length) {
            // TODO: write log
            return;
        }
        const logChannel = client.channels.cache.get(config.modmailLogChannelId);
        if(!logChannel) {
            // TODO: write log
            return;
        }
        const modmail = await databaseManager.getModmail(channelId);
        const modmailUser = client.users.cache.get(modmail.userId);
        if(!modmailUser) {
            // TODO: write log
            return;
        }

        const closeEmbed = new EmbedBuilder()
            .setColor(Colors.DarkGold)
            .setTitle("This modmail has been closed.")
            .setDescription(`The transcription of this modmail is being generated.`);
        const userMessage = await modmailUser.send({ embeds: [closeEmbed] });
        setTimeout(async () => {
            closeEmbed.setTitle("This modmail has been closed.");
            closeEmbed.setDescription(`Modmail transcription generated:`);
            await userMessage.edit({ embeds: [closeEmbed] });
            await modmailUser.send({ files: [logs[0]] });
        }, Time.seconds(2));
        
        closeEmbed.setDescription(`This channel will be deleted shortly.`);
        await (channel as GuildTextBasedChannel).send({embeds: [closeEmbed]});

        closeEmbed.setTitle(`Modmail with uid ${channelId} has been closed.`);
        closeEmbed.setDescription(`Public and private transcriptions:`);
        await (logChannel as GuildTextBasedChannel).send({embeds: [closeEmbed], files: [...logs]});
        await databaseManager.closeModmail(channelId);
        setTimeout(async () => {
            await channel.delete();
        }, Time.seconds(5));
    }

    private async generateLogs(channel: GuildTextBasedChannel): Promise<AttachmentBuilder[]> {
        const publicMessages: Message<boolean>[] = [];
        channel.messages.fetch();
        channel.messages.cache.forEach((message) => {
            if(message.embeds.length && !message.stickers.size) {
                publicMessages.push(message);
            }
        });
        const publicLog = await dhtml.generateFromMessages(publicMessages, channel, {saveImages: true});
        const privateLog = await dhtml.createTranscript(channel, {saveImages: true});
        publicLog.setName(`${channel.id}.htm`);
        privateLog.setName(`${channel.id}_private.htm`);
        return [publicLog, privateLog];
    }
}

export const modmailHandler = new ModmailHandler();