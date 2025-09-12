import { Command } from '../../structures/command';
import {
    ActionRow,
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    Interaction,
    MessageActionRowComponent,
    Webhook,
    WebhookType
} from 'discord.js'
import { Logger } from '../../logger';
import { databaseManager } from '../../structures/database';
import { config } from '../../const';
import { client } from '../../structures/client';

const logger = new Logger('RemoveServerCmd');

export default new Command({
    name: 'remove-server',
    description: "Used for removing servers from the network.",
    options:[{
        name: 'server-id',
        description: 'The id of the server you want to remove.',
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }
        const mainGuild = client.guilds.cache.get(config.mainServerId);
        if(!mainGuild) return; //TODO: log
        const guildUser = mainGuild.members.cache.get(options.interaction.user.id);
        if(!guildUser) {
            await options.interaction.reply({ content: `You do not have permission to use this!`, ephemeral: true });
            return;
        }
        if(!guildUser.roles.cache.has(config.navigatorRoleId)) {
            await options.interaction.reply({ content: `You do not have permission to use this!`, ephemeral: true });
            return;
        }

        const removedServer = client.guilds.cache.get(options.args.getString('server-id') ?? '');
        if(!removedServer) {
            await options.interaction.reply({ content: 'Could not find the server, please verify that the bot is on it, if it is dm Birb.', ephemeral: true });
            return;
        }
        
        const serverAeonWebhooks = config.activeWebhooks.filter((webhook) => webhook.guildId === options.interaction.guildId);
        if(!serverAeonWebhooks.length) {
            await options.interaction.reply({content: 'There are no aeon webhooks on the specified server.', ephemeral: true});
            return;
        }

        const webhookButtons = new ActionRowBuilder<ButtonBuilder>();
        serverAeonWebhooks.forEach((aeonWebhook) => {
            const button = new ButtonBuilder()
                .setCustomId(aeonWebhook.id)
                .setLabel(aeonWebhook.name.slice(5))
                .setStyle(ButtonStyle.Primary)
            
            webhookButtons.addComponents(button);
        });

        const replyEmbed = new EmbedBuilder()
            .setTitle("Remove network connection")
            .setDescription(`To remove a connection from ${removedServer.name} please click one of the buttons.`)

        const filter = (i : Interaction) => {
            return i.user.id === options.interaction.user.id;
        }
        const reply = await options.interaction.reply({embeds: [replyEmbed], components: [webhookButtons]});
        const collector = reply.createMessageComponentCollector({ filter });
        collector.on('collect', async (componentInteraction) => {
            const selectedWebhook = serverAeonWebhooks.find((webhook) => webhook.id === componentInteraction.customId);
            if(!selectedWebhook) {
                logger.warn("Could not find webhook")
                return;
            }
            const selectedWebhookPosition = config.activeWebhooks.findIndex((webhook) => webhook === selectedWebhook)
            try {
                console.log(config.activeWebhooks);
                config.activeWebhooks.slice(selectedWebhookPosition, selectedWebhookPosition);
                console.log(config.activeWebhooks);
                await selectedWebhook.delete();
                await databaseManager.deleteBroadcastByWebhookId(componentInteraction.customId);
            } catch(error) {
                logger.error('Could not delete webhook.', (error as Error));
                await componentInteraction.deferUpdate();
                await componentInteraction.followUp({content: 'Could not delete webhook.', flags: "Ephemeral"});
            }

            const message = componentInteraction.message;
            webhookButtons.components.length = 0;
            message.components.forEach((row) => {
                (row as ActionRow<MessageActionRowComponent>).components.forEach((buttonComponent) => {
                    if(buttonComponent.type === ComponentType.Button) {
                        if(!buttonComponent.customId) {
                            logger.wtf("No button custom id.");
                            return;
                        }
                        if(!buttonComponent.label) {
                            logger.wtf("No button label.");
                            return;
                        }
                        const button = new ButtonBuilder()
                            .setCustomId(buttonComponent.customId)
                            .setLabel(buttonComponent.label)
                            .setStyle(ButtonStyle.Primary)

                        if(buttonComponent.customId === componentInteraction.customId) {
                            button.setDisabled(true);
                        }
                        webhookButtons.addComponents(button);
                    }
                })
            })

            await options.interaction.editReply({embeds: [replyEmbed], components: [webhookButtons]})
        })
    }
});