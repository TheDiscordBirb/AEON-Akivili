import {
    ApplicationCommandDataResolvable,
    Client,
    ClientEvents,
    Collection,
    IntentsBitField,
    Partials
} from "discord.js";
import { CommandType } from "../types/command";
import { glob } from "glob";
import { ExtendedClientTypes, RegisterCommandsOptions } from "../types/client";
import { Event } from "./event";
import * as path from 'path';
import { Logger } from '../logger';
import { getEnvVar } from "../utils/get-env-var";
import { config } from "../const";
import { ErrorNames } from "../types/error-handler";
import { databaseManager } from "./database";

const logger = new Logger('Client');

export class ExtendedClient extends Client {
    protected discordToken;
    public clientType: ExtendedClientTypes;
    commands: Collection<string, CommandType> = new Collection();

    constructor(token: string) {
        super({
            intents: [
                IntentsBitField.Flags.Guilds,
                IntentsBitField.Flags.GuildMembers,
                IntentsBitField.Flags.GuildMessages,
                IntentsBitField.Flags.MessageContent,
                IntentsBitField.Flags.DirectMessages,
                IntentsBitField.Flags.DirectMessageReactions,
                IntentsBitField.Flags.GuildMessageReactions,
                IntentsBitField.Flags.GuildExpressions,
                IntentsBitField.Flags.GuildMessageTyping,
            ],
            partials: [Partials.Channel, Partials.Message],
        });
        this.discordToken = token
    }

    start() {
        config.botStarting = true;
        this.registerModules()
        .then(()=> {
            this.login(this.discordToken)
            .then(() => {
                logger.info(`Logged into Discord.`, this.user?.id);
            })
        })
    }  

    async setType() {
        if(!this.user) throw new Error(ErrorNames.DID_NOT_GENERATE_CLIENT);
        const cachedClients = await databaseManager.loadClientTypes();
        const cachedClient = cachedClients.find((client) => client.clientId === this.user?.id)
        if(!cachedClient) {
            this.clientType = ExtendedClientTypes.ALPHA;
            return;
        }
        this.clientType = cachedClient.type;
    }

    async importFile(filePath: string) {
        let importFile;
        try {
            importFile = await import(filePath);
        } catch (error) {
            logger.error(`Could not import file. Error: `, (error as Error), this.user?.id);
        }
        if (!importFile) {
            logger.warn(`Could not import command file. FilePath: ${filePath}`, undefined, this.user?.id);
            return;
        }
        return importFile.default;
    }

    async registerCommands({ commands, guildId }: RegisterCommandsOptions) {
        if (guildId) {
            this.guilds.cache.get(guildId)?.commands.set(commands);
            logger.info(`Registering commands to ${guildId}`, this.user?.id);
        } else {
            if (!this.application) {
                logger.warn('Could not register commands. No application found.', undefined, this.user?.id);
                return;
            }
            this.application.commands.set(commands);
            logger.info('Registering global commands', this.user?.id);
        }
    }

    async registerModules() {
        // Commands
        const slashCommands: ApplicationCommandDataResolvable[] = [];
        const commandsPath = path.join(__dirname, '..', 'commands', '**', '*{.ts,.js}').replace(/\\/g, '/');
        const commandFiles = glob.sync(commandsPath);
        await Promise.all(commandFiles.map(async (filePath) => {
            const command: CommandType = await this.importFile(filePath);
            if (!command.name) {
                logger.warn(`Could not find command name for file. FilePath: ${filePath}`, undefined, this.user?.id);
                return;
            }

            try {
                logger.info(`Registering command: ${command.name}`, this.user?.id);
                this.commands.set(command.name, command);
                slashCommands.push(command);
            } catch (error) {
                logger.warn(`Could not push command to bot: ${command.name}`, undefined, this.user?.id)
            }
        }));

        this.on('clientReady', () => {
            this.registerCommands({commands: slashCommands})
            .then(() => {
                logger.info('Commands registered.', this.user?.id);
            });
        });

        // Event
        const eventsPath = path.join(__dirname, '..', 'events', '**', '*{.ts,.js}').replace(/\\/g, '/');
        const eventFiles = glob.sync(
            eventsPath,
        );
        eventFiles.forEach(async (filePath) => {
            const event: Event<keyof ClientEvents> = await this.importFile(filePath);
            this.on(event.event, event.run);
        });
    }
}

const generateClients = (): ExtendedClient[] => {
    const clients: ExtendedClient[] = [];
    for(const token of getEnvVar<string>("DISCORD_TOKENS").split(" ")) {
        clients.push(new ExtendedClient(token));
    }
    return clients;
}

export const clients: ExtendedClient[] = generateClients();