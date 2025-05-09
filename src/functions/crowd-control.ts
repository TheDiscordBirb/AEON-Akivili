import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Colors,
    ComponentType,
    EmbedBuilder,
    GuildMember,
    GuildTextBasedChannel,
    Message
} from "discord.js"
import { CrowdControlArg, EmojiReplacementData } from "../types/event";
import { client } from "../structures/client";
import { config } from "../const";
import { clearanceLevel } from "../utils";
import { ClearanceLevel } from "../types/client";
import { Logger } from "../logger";

const logger = new Logger("CrowdControlHandler")

class CrowdControlHander {
    public async crowdControl(webhookChannelType: string,
        interaction: Message<boolean>,
        interactionMember: GuildMember,
        emojiReplacement: EmojiReplacementData): Promise<boolean> {
            if(!config.crowdControlActive) {
                return false;
            }
            let interactionContent = emojiReplacement.content;
            if(!interactionContent) {
                interactionContent = `"No message content"`;
            }
            const confirmationEmbed = new EmbedBuilder()
                .setAuthor({name: `${interactionMember.displayName} | ${interactionMember.id} | ${interaction.guild?.name}`, iconURL: interactionMember.user.avatarURL() ?? undefined})
                .setDescription(interactionContent)
                .setFooter({text: `Aeon ${webhookChannelType} | ${new Date(Date.now()).toLocaleString('en-US',{ hourCycle: "h12" })}`})

            let attachments = "";
            interaction.attachments.forEach((attachment) => {
                attachments += `${attachment.url}\n`
            })
            if(attachments) {
                confirmationEmbed.addFields({name: "Files:", value: attachments});
            }

            const crowdControlActionRow = new ActionRowBuilder<ButtonBuilder>();
            const crowdControlAllowButton = new ButtonBuilder()
                .setCustomId(CrowdControlArg.ALLOW)
                .setStyle(ButtonStyle.Success)
                .setLabel("Allow")

            const crowdControlRejectButton = new ButtonBuilder()
                .setCustomId(CrowdControlArg.REJECT)
                .setStyle(ButtonStyle.Danger)
                .setLabel("Reject")

            crowdControlActionRow.addComponents(crowdControlAllowButton, crowdControlRejectButton);

            const channel = client.channels.cache.get(config.crowdControlChannelId) as GuildTextBasedChannel;
            if(!channel) {
                // TODO: write log
                return false;
            }
            const response = (await channel.send({embeds: [confirmationEmbed], components: [crowdControlActionRow]})).awaitMessageComponent({componentType: ComponentType.Button})
                .then(async (buttonClick) => {
                    if(!(clearanceLevel(buttonClick.user) >= ClearanceLevel.NAVIGATOR)) throw new Error("Not high enough clearance.");
                    switch(buttonClick.customId) {
                        case CrowdControlArg.ALLOW: 
                            this.embedBuilder(true, buttonClick);
                            return false;
                        case CrowdControlArg.REJECT:
                            this.embedBuilder(false, buttonClick);
                            return true;
                        default:
                            this.embedBuilder(true, buttonClick);
                            return false
                    }
                })
                .catch(async (exception) => {
                    logger.warn(exception);
                    return false;
                })
            return await response;
    }
    private async embedBuilder(allow: boolean, interaction: ButtonInteraction<"cached">): Promise<void> {
        const message = interaction.message;
        const firstEmbed = message.embeds[0]
        if(!firstEmbed) {
            return;
        }
        let colorEmbed;
        const button = new ButtonBuilder()
            .setDisabled(true)
            .setCustomId("Disabled");
        switch(allow) {
            case true:
                button.setLabel("Allowed");
                button.setStyle(ButtonStyle.Success);
                colorEmbed = new EmbedBuilder({...firstEmbed.data, color: Colors.Green});
                break;
            case false:    
                button.setLabel("Rejected");
                button.setStyle(ButtonStyle.Danger);
                colorEmbed = new EmbedBuilder({...firstEmbed.data, color: Colors.Red});
                break;
        }
        const buttonRow = new ActionRowBuilder<ButtonBuilder>();
        buttonRow.addComponents(button);
        await message.edit({components: [buttonRow], embeds: [colorEmbed]});
    }
}

export const crowdControl = new CrowdControlHander();