import {
    ApplicationCommandDataResolvable,
    Client,
    ClientEvents,
    Collection,
    IntentsBitField
} from "discord.js";
import { CommandType } from "../types/command";
import glob from "glob";
import { RegisterCommandsOptions } from "../types/client";
import { Event } from "./event";
import * as path from 'path';
import { Logger } from '../logger';
import { getEnvVar } from "../get-env-var";

const logger = new Logger('Client');

export class ExtendedClient extends Client {
    commands: Collection<string, CommandType> = new Collection();

    constructor() {
        super({
            intents: [
                IntentsBitField.Flags.Guilds,
                IntentsBitField.Flags.GuildMembers,
                IntentsBitField.Flags.GuildMessages,
                IntentsBitField.Flags.MessageContent,
                IntentsBitField.Flags.DirectMessages,
                IntentsBitField.Flags.DirectMessageReactions,
                IntentsBitField.Flags.GuildMessageReactions
            ]
        });
    }

    start() {
        this.registerModules()
        .then(()=> {
            this.login(getEnvVar<string>("DISCORD_TOKEN"))
            .then(() => {
                logger.info('Logged into Discord.');
            })
        })
    }  

    async importFile(filePath: string) {
        let importFile;
        try {
            importFile = await import(filePath);
        } catch (error) {
            logger.error(`Could not import file. Error: `, (error as Error));
        }
        if (!importFile) {
            logger.warn(`Could not import command file. FilePath: ${filePath}`);
            return;
        }
        return importFile.default;
    }

    async registerCommands({ commands, guildId }: RegisterCommandsOptions) {
        if (guildId) {
            this.guilds.cache.get(guildId)?.commands.set(commands);
            logger.info(`Registering commands to ${guildId}`);
        } else {
            if (!this.application) {
                logger.warn('Could not register commands. No application found.');
                return;
            }
            this.application.commands.set(commands);
            logger.info('Registering global commands');
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
                logger.warn(`Could not find command name for file. FilePath: ${filePath}`);
                return;
            }

            try {
                logger.info(`Registering command: ${command.name}`);
                this.commands.set(command.name, command);
                slashCommands.push(command);
            } catch (error) {
                logger.warn(`Could not push command to bot: ${command.name}`)
            }
        }));

        this.on('ready', () => {
            this.registerCommands({commands: slashCommands})
            .then(() => {
                logger.info('Commands registered.');
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

export const client = new ExtendedClient();
