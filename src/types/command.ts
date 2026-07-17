import {
    ChatInputApplicationCommandData,
    CommandInteraction,
    CommandInteractionOptionResolver,
    GuildMember,
    PermissionResolvable
} from "discord.js";
import { ExtendedClient } from "../structures/client";

export interface ExtendedInteraction extends CommandInteraction {
    member: GuildMember;
}

export interface RunOptions {
    client: ExtendedClient;
    interaction: ExtendedInteraction;
    args: CommandInteractionOptionResolver;
}

type RunFunction = (options: RunOptions) => any;

export type CommandType = {
    userPermissions?: PermissionResolvable[];
    run: RunFunction;
} & ChatInputApplicationCommandData;

export enum BanShareOption {
    YES = 'yes',
    NO = 'no',
}

export enum NetworkJoinOptions {
    BANSHARE = 'Banshare',
    STAFF = 'Staff',
    GENERAL = 'General',
    INFO = 'Info'
}

export enum AutoBanLevelOptions {
    NONE = '0',
    IMPORTANT = '1',
    ALL = '2'
}

export enum ButtonTypes {
    BACK = 'back',
    FORWARD = 'forward',
    SERVER_SELECTOR = 'serverSelector',
    WEBHOOK = 'webhook',
    MENU_BACK = 'menuBack',
    REMOVE_SERVER = 'removeServer'
}

export enum Regions {
    AMERICA = "us",
    EUROPE = "eu",
    ASIA = "as"
}

export enum CatCakes {
    AKIVILI_CAKE = "Akivimeow",
    ASTRA_LATTE = "AstraLatte",
    BLUEBERRY_JAR = "Blueberry Jar",
    BUTTERFLY_PEA_Mousse = "Butterfly Pea Mousse",
    CHARMONY_KITTY = "Charmony Kitty",
    COCONUT_SNOW_CAP = "Coconut Snow Cap",
    DIVINER_MOCHI = "Diviner Mochi",
    DOZING_MEOW = "Dozing Meow",
    FLOWER_VIEWING_DANGO = "Flower-Viewing Dango",
    FLUFFY_FIREFLY = "Fluffy Firefly",
    GATEAU_GAMER = "Gateau Gamer",
    GRAVI_CRISP = "GraviCrisp",
    HONEY_DICE = "Honey Dice",
    ICE_CAKE = "Ice Cake",
    LAMBDAS_FRIEND = "Lambda's Friend",
    LUCKY_SNACK = "Lucky Snack",
    MINT_TIRAMISU = "Mint Tiramisu",
    PURE_SUGAR_CHILD = "Pure Sugar Child",
    RED_BEAN_MILK = "Red Bean Milk",
    RICE_DUMPLING = "Rice Dumpling",
    SESAME_CAKE = "Sesame Cake",
    SHADER_CAT = "Shader Cat",
    SUNDAE_ANGELICA = "Sundae Angelica",
    TRASH_CAKE = "Trash Cake",
    TROUBLEMAKER = "Troublemaker",
    WHITE_JADE_GREEN_DUMPLING = "White Jade Green Dumpling",
    WHITE_PEACH_PUDDING = "White Peach Pudding",
    WISTERIA_CAKE = "Wisteria Cake",
}