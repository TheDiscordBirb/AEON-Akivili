import { 
    ButtonBuilder, 
    ButtonStyle, 
    ContainerBuilder,
    Message,
    SectionBuilder,
    TextDisplayBuilder, 
    User 
} from "discord.js";
import { Logger } from "../logger";
import { ErrorData } from "../types/error-handler";
import { clients } from "./client";
import { config } from "../const";

const logger = new Logger("ErrorHandler");

class ErrorHandler {
    async showError(errorData: ErrorData) {
        const errorContainer = await this.errorContainerGenerator(errorData);
        try {
            await errorData.user.createDM();
            const errorMessage = await errorData.user.send({
                components: [errorContainer],
                flags: 'IsComponentsV2',
            });
            await this.sendErrorButton(errorMessage, errorContainer);
        } catch(e) {
            logger.warn(`Couldnt send error message to ${errorData.user.username}`);
            return;
        }
    }

    async sendErrorButton(errorMessage: Message<boolean>, errorContainer: ContainerBuilder) {
        const errorMessageCollector = errorMessage.createMessageComponentCollector();
        errorMessageCollector.on('collect', async (componentInteraction) => {
            let birb: User | undefined;
            for(const client of clients) {
                if(client.users.cache.get(config.birbId)) {
                    birb = client.users.cache.get(config.birbId);
                }
            }
            if(!birb) {
                await errorMessage.edit(
                    {
                        components: [errorContainer.spliceComponents(0, errorContainer.components.length - 1)
                            .addTextDisplayComponents(
                                (t) => t.setContent("# Birb does not exist o.O")
                            )
                        ]
                    });
                return;
            }
            const disabledButton = ((errorContainer.components[0] as SectionBuilder).accessory as ButtonBuilder)
                .setDisabled(true)
                .setStyle(ButtonStyle.Success)
                .setLabel("Sent to Birb")
            const disabledButtonSection = new SectionBuilder((errorContainer.components[0] as SectionBuilder).data)
                .addTextDisplayComponents(new TextDisplayBuilder({content: "# Error" }))
                .setButtonAccessory(disabledButton);
            await errorMessage.edit({components: [errorContainer.spliceComponents(0, 1, disabledButtonSection)]});

            await birb.send({
                components: [
                    errorContainer.spliceComponents(0, 1, 
                        new TextDisplayBuilder({content: `# ${componentInteraction.user.username} got an error:`})
                    )
                ], 
                flags: 'IsComponentsV2'
            });
        })
    }

    async errorContainerGenerator(errorData: ErrorData): Promise<ContainerBuilder> {
        const sendToBirbButton = new ButtonBuilder()
            .setStyle(ButtonStyle.Danger)
            .setLabel("Send to Birb")
            .setCustomId("errorDm")
        
        const errorContainer = new ContainerBuilder()
            .setAccentColor(0xff0000)
            .addSectionComponents((section) => 
                section
                .addTextDisplayComponents(
                    (textDisplay) => textDisplay.setContent("# Error")
                )
                .setButtonAccessory(sendToBirbButton)
            )
            .addSeparatorComponents(
                (separator) => separator.setDivider(true)
            )
            .addTextDisplayComponents(
                (textDisplay) => textDisplay
                    .setContent(`Akivili ran into an error during the execution of "${errorData.interactionType}"`),
                (textDisplay) => textDisplay.setContent(`-# Error message:   ${errorData.error.message}`)
            );
        return errorContainer;
    }
}

export const errorHandler = new ErrorHandler();