import { 
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle, 
    ComponentType, 
    ContainerBuilder,
    Interaction,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from "discord.js";
import { Command } from "../../structures/command";
import { CatCakeTypes, Regions, RunOptions } from "../../types/command";
import { Logger } from "../../logger";
import { ActionRowBuilder } from "@discordjs/builders";
import { databaseManager } from "../../structures/database";
import { ErrorNames, InteractionTypes } from "../../types/error-handler";
import { errorHandler } from "../../structures/error-handler";

const logger = new Logger("CatCakes");

export const catcakeTradingChecks = async (options: RunOptions) => {
    if(!options.interaction.guild) throw new Error(ErrorNames.NO_GUILD);
    const region = options.args.getString("region") as Regions | null;
    if(!region) throw new Error(ErrorNames.NO_REQUIRED_FIELD);

    await catcakeTradingCommand(options, region);
}

// TODO: test
export default new Command({
    name: "catcake-trading",
    description: "Gotta catch 'em all.",
    options: 
    [
        {
            name: "region",
            description: "Your region.",
            type: ApplicationCommandOptionType.String,
            choices:
            [
                {name: "America", value: Regions.AMERICA},
                {name: "Europe", value: Regions.EUROPE},
                {name: "Asia", value: Regions.ASIA}
            ],
            required: true
        },
        {
            name: "uid",
            description: "Your uid",
            type: ApplicationCommandOptionType.String,
            required: false
        }
    ],

    run: async (options) => {
        try {
            await catcakeTradingChecks(options);
        } catch(e) {
            await errorHandler.showError({
                error: e as Error,
                user: options.interaction.user,
                interactionType: InteractionTypes.CATCAKE_TRADING
            });
            logger.error(`Got error during ${options.interaction.commandName} command.`, e as Error, options.client.user?.id);   
        }
    }
});

export const catcakeTradingCommand = async (options: RunOptions, region: Regions) => {
    const shareButton = new ButtonBuilder()
        .setCustomId("share")
        .setLabel("Share a cat")
        .setStyle(ButtonStyle.Primary);
    
    const lookForButton = new ButtonBuilder()
        .setCustomId("lookFor")
        .setLabel("Look for a cat")
        .setStyle(ButtonStyle.Primary);

    const container = new ContainerBuilder()
        .setAccentColor(0x9c8644)
        .addTextDisplayComponents(
            (textDisplay) => textDisplay.setContent(`# Cat Cake Trading Plaza`),
        )
        .addSeparatorComponents((separator) => separator.setDivider(true))
        .addTextDisplayComponents(
            (textDisplay) => textDisplay.setContent(`To share your cat cakes with others:\nYou have to set "Allow strangers to enter Party Car" to "Yes" or accept friend requests.`),
        )
        .addActionRowComponents<ButtonBuilder>((actionRow) => actionRow.addComponents(shareButton, lookForButton))

    const message = await options.interaction.reply({components: [container], flags: ['Ephemeral', 'IsComponentsV2']});
    const filter = (i : Interaction) => {
        return i.user.id === options.interaction.user.id;
    }

    let catCakesString: string = "";
    let idx = 1;
    for(const catType of Object.values(CatCakeTypes)) {
        catCakesString += `${idx++} : ${catType}${idx === 28 ? "" : "\n"}`;
    }
    const componentCollector = message.createMessageComponentCollector({filter});
    const sharedCats: string[] = [];
    let lookForCat = "";

    const stringSelectMenuBuilders: StringSelectMenuBuilder[] = [];
    let jdx = 0;
    let kdx = 0;
    const catSections: string[][] = [[], []];
    for(const catType of Object.values(CatCakeTypes)) {
        if(jdx <= Object.keys(CatCakeTypes).length/2) {
            jdx++;
            catSections[kdx].push(catType);
        } else {
            jdx = 0;
            catSections[++kdx].push(catType);
        }
    }

    componentCollector.on('collect', async (component) => {
        if(component.customId === "share") {
            const uid = options.args.getString("uid");
            await clearContainer(container);
            if(!uid) {
                container.spliceComponents
                container.addTextDisplayComponents(
                    (textDisplay) => textDisplay.setContent("To share a cat cake you need to input your uid.")
                )
                await message.edit({components: [container]});
                return;
            }

            const stringSelectMenus = await genStringSelect("share", 3, catSections);
            for(const stringSelectMenu of stringSelectMenus) {
                stringSelectMenuBuilders.push(stringSelectMenu);
            };
            
            const shareCatsButton = new ButtonBuilder()
                .setLabel("Share Cat cake(s)")
                .setCustomId("shareCats")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)

            container.addTextDisplayComponents(
                (textComponent) => textComponent.setContent(`## Select the Cat cake(s) you want to share`)
            );
            container.addTextDisplayComponents(
                (textComponent) => textComponent.setContent(`Cat cake 1: `)
            );
            await stringSelect(container, stringSelectMenuBuilders, 0);
            container.addSeparatorComponents((separator) => separator.setDivider(true));
            container.addTextDisplayComponents(
                (textComponent) => textComponent.setContent(`Cat cake 2: `)
            );
            await stringSelect(container, stringSelectMenuBuilders, 1);
            container.addSeparatorComponents((separator) => separator.setDivider(true));
            container.addTextDisplayComponents(
                (textComponent) => textComponent.setContent(`Cat cake 3: `)
            );
            await stringSelect(container, stringSelectMenuBuilders, 2);
            container.addSeparatorComponents((separator) => separator.setDivider(true));
            container.addActionRowComponents(
                (actionRow) => actionRow.addComponents(shareCatsButton)
            )

            await message.edit({components: [container]});
            return;
        } else if(component.customId === "lookFor") {
            await clearContainer(container);
            const stringSelectMenus = await genStringSelect("lookFor", 1, catSections);
            for(const stringSelectMenu of stringSelectMenus) {
                stringSelectMenuBuilders.push(stringSelectMenu);
            };

            const lookForSpecificCatButton = new ButtonBuilder()
                .setLabel("Look for Cat cake")
                .setCustomId("lookForSpecificCat")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)

            const lookForAllCatsButton = new ButtonBuilder()
                .setLabel("Check all Cat Cakes")
                .setCustomId("lookForAllCats")
                .setStyle(ButtonStyle.Success)

            await clearContainer(container);
            container.addTextDisplayComponents(
                (textComponent) => textComponent.setContent(`## Select the cat cake you want to look for`)
            );
            await stringSelect(container, stringSelectMenuBuilders, 0);
            container.addSeparatorComponents((separator) => separator.setDivider(true));
            container.addActionRowComponents(
                (actionRow) => actionRow.addComponents(lookForSpecificCatButton, lookForAllCatsButton)
            )

            await message.edit({components: [container]});
            return;
        }

        if(component.component.type === ComponentType.StringSelect) {
            const args = component.customId.split(" ");
            if(args[0] === "stringSelect") {
                if(args[2] === "share") {
                    const actionRow11 = new ActionRowBuilder<StringSelectMenuBuilder>();
                    actionRow11.setComponents((container.components[4] as ActionRowBuilder<StringSelectMenuBuilder>).components);
                    const actionRow12 = new ActionRowBuilder<StringSelectMenuBuilder>();
                    actionRow12.setComponents((container.components[6] as ActionRowBuilder<StringSelectMenuBuilder>).components);
                    const actionRow21 = new ActionRowBuilder<StringSelectMenuBuilder>();
                    actionRow21.setComponents((container.components[9] as ActionRowBuilder<StringSelectMenuBuilder>).components);
                    const actionRow22 = new ActionRowBuilder<StringSelectMenuBuilder>();
                    actionRow22.setComponents((container.components[11] as ActionRowBuilder<StringSelectMenuBuilder>).components);
                    const actionRow31 = new ActionRowBuilder<StringSelectMenuBuilder>();
                    actionRow31.setComponents((container.components[14] as ActionRowBuilder<StringSelectMenuBuilder>).components);
                    const actionRow32 = new ActionRowBuilder<StringSelectMenuBuilder>();
                    actionRow32.setComponents((container.components[16] as ActionRowBuilder<StringSelectMenuBuilder>).components);

                    const actionRow4 = new ActionRowBuilder<ButtonBuilder>();
                    actionRow4.setComponents((container.components[18] as ActionRowBuilder<ButtonBuilder>).components);
                    if(actionRow4.components[0].data.disabled) {
                        actionRow4.components[0].setDisabled(false);
                        actionRow4.components[0].setStyle(ButtonStyle.Success);
                    }

                    if(args[3] === "0") {
                        actionRow11.components[0].setDisabled(true);
                        actionRow12.components[0].setDisabled(true);
                        if(args[1] == "0") {
                            actionRow11.components[0].setPlaceholder((component as StringSelectMenuInteraction).values[0]);
                        } else {
                            actionRow12.components[0].setPlaceholder((component as StringSelectMenuInteraction).values[0]);
                        }
                        container.spliceComponents(4, 1, actionRow11);
                        container.spliceComponents(6, 1, actionRow12);
                    } else if(args[3] === "1") {
                        actionRow21.components[0].setDisabled(true);
                        actionRow22.components[0].setDisabled(true);
                        if(args[1] == "0") {
                            actionRow21.components[0].setPlaceholder((component as StringSelectMenuInteraction).values[0]);
                        } else {
                            actionRow22.components[0].setPlaceholder((component as StringSelectMenuInteraction).values[0]);
                        }
                        container.spliceComponents(9, 1, actionRow21);
                        container.spliceComponents(11, 1, actionRow22);
                    } else {
                        actionRow31.components[0].setDisabled(true);
                        actionRow32.components[0].setDisabled(true);
                        if(args[1] == "0") {
                            actionRow31.components[0].setPlaceholder((component as StringSelectMenuInteraction).values[0]);
                        } else {
                            actionRow32.components[0].setPlaceholder((component as StringSelectMenuInteraction).values[0]);
                        }
                        container.spliceComponents(14, 1, actionRow31);
                        container.spliceComponents(16, 1, actionRow32);
                    }
                    await component.deferUpdate();
                    sharedCats.push((component as StringSelectMenuInteraction).values[0]);
                    await message.edit({components: [container]});
                }

                if(args[2] === "lookFor") {
                    const actionRow1 = new ActionRowBuilder<StringSelectMenuBuilder>();
                    actionRow1.setComponents((container.components[3] as ActionRowBuilder<StringSelectMenuBuilder>).components);
                    const actionRow2 = new ActionRowBuilder<StringSelectMenuBuilder>();
                    actionRow2.setComponents((container.components[5] as ActionRowBuilder<StringSelectMenuBuilder>).components);
                    actionRow1.components[0].setDisabled(true);
                    actionRow2.components[0].setDisabled(true);

                    if(args[1] == "0") {
                        actionRow1.components[0].setPlaceholder((component as StringSelectMenuInteraction).values[0]);
                    } else {
                        actionRow2.components[0].setPlaceholder((component as StringSelectMenuInteraction).values[0]);
                    }
                    container.spliceComponents(3, 1, actionRow1);
                    container.spliceComponents(5, 1, actionRow2);

                    const actionRow3 = new ActionRowBuilder<ButtonBuilder>();
                    actionRow3.setComponents((container.components[7] as ActionRowBuilder<ButtonBuilder>).components);
                    actionRow3.components[0].setDisabled(false);
                    actionRow3.components[0].setStyle(ButtonStyle.Success);
                    

                    container.spliceComponents(7, 1, actionRow3);

                    await component.deferUpdate();
                    lookForCat = (component as StringSelectMenuInteraction).values[0];
                    await message.edit({components: [container]});
                }
            }
        }

        if(component.customId === "shareCats") {
            const uid = options.args.getString("uid");
            if(!uid) return;
            for(const catCake of sharedCats) {
                try {
                    await databaseManager.insertIntoCatCakes(uid, region, catCake as CatCakeTypes);
                } catch(e) {
                    logger.error("Error during cat cake saving.", e as Error);
                    await clearContainer(container);
                    container.addTextDisplayComponents(
                        (textComponent) => textComponent.setContent(`## An Error occured while saving cat cakes into database.`)
                    );
                    await message.edit({components: [container]});
                    return;
                }
            }
            await clearContainer(container);
            container.addTextDisplayComponents(
                (textComponent) => textComponent.setContent(`## Your cat cakes have been added to the database.`)
            );
            await message.edit({components: [container]});
            return;
        }

        if(component.customId === "lookForSpecificCat") {
            try {
                const catsInDb = await databaseManager.checkForCat(region, lookForCat as CatCakeTypes);
                if(catsInDb.length == 0) {
                    await clearContainer(container);
                    container.addTextDisplayComponents(
                        (textComponent) => textComponent.setContent(`## No one has that cat cake yet.`)
                    );
                    await message.edit({components: [container]});
                    return; 
                }
                let catString = "";
                for(const catInDb of catsInDb) {
                    catString += `${catInDb.uid}\n`
                }
                await clearContainer(container);
                container.addTextDisplayComponents(
                    (textComponent) => textComponent.setContent(`## The following people have ${catsInDb[0].catType}:`)
                )
                container.addTextDisplayComponents(
                    (textComponent) => textComponent.setContent(catString.trim())
                )
                await message.edit({components: [container]});
                return; 
            } catch(e) {
                logger.error("Error during cat cake retrival.", e as Error);
                await clearContainer(container);
                container.addTextDisplayComponents(
                    (textComponent) => textComponent.setContent(`## An Error occured while searching for cat cakes in database.`)
                );
                await message.edit({components: [container]});
                return;
            }
        }

        if(component.customId === "lookForAllCats") {
            try {
                const catsInDb = await databaseManager.allCatsInRegion(region);
                if(catsInDb.length == 0) {
                    await clearContainer(container);
                    container.addTextDisplayComponents(
                        (textComponent) => textComponent.setContent(`## No one has any cat cakes here yet.`)
                    );
                    await message.edit({components: [container]});
                    return; 
                }
                let catString = "";
                for(const catInDb of catsInDb) {
                    catString += `${catInDb.uid} : ${catInDb.catType}\n`
                }
                await clearContainer(container);
                container.addTextDisplayComponents(
                    (textComponent) => textComponent.setContent(`## These are the cats in your region:`)
                )
                container.addTextDisplayComponents(
                    (textComponent) => textComponent.setContent(catString.trim())
                )
                await message.edit({components: [container]});
                return; 
            } catch(e) {
                logger.error("Error during all cat cakes retrival.", e as Error);
                await clearContainer(container);
                container.addTextDisplayComponents(
                    (textComponent) => textComponent.setContent(`## An Error occured while searching for cat cakes in database.`)
                );
                await message.edit({components: [container]});
                return;
            }
        }
    });
}

const stringSelect = async(container: ContainerBuilder, stringSelectMenuBuilders: StringSelectMenuBuilder[], i: number) => {
    container.addActionRowComponents<StringSelectMenuBuilder>(
        (actionRow) => actionRow.addComponents(stringSelectMenuBuilders[i*2])
    )
    container.addSeparatorComponents((separator) => separator.setDivider(false));
    container.addActionRowComponents<StringSelectMenuBuilder>(
        (actionRow) => actionRow.addComponents(stringSelectMenuBuilders[i*2+1])
    )
}

const genStringSelect = async(type: "share" | "lookFor", idx: number, catSections: string[][]) => {
    const stringSelectMenus: StringSelectMenuBuilder[] = [];
    for(let i = 0; i < idx; i++) {
        let jdx = 0;
        for(const catSection of catSections) {
            const stringSelectMenu = new StringSelectMenuBuilder()
                .setCustomId(`stringSelect ${jdx++} ${type} ${i}`)
                .setPlaceholder("Choose a cat cake.")
            for(const cat of catSection) {
                stringSelectMenu.addOptions({label: cat, value: cat});
            }
            stringSelectMenus.push(stringSelectMenu);
        }
    }
    return stringSelectMenus;
}

const clearContainer = async(container: ContainerBuilder) => {
    container.spliceComponents(2, container.components.length - 2);
}