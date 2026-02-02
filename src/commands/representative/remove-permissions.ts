import { Command } from '../../structures/command';
import { ApplicationCommandOptionType} from 'discord.js'
import { isConductor, isDev, isNavigator, isRep } from '../../utils';
import { Logger } from '../../logger';
import { config } from '../../const';

const logger = new Logger('RmvPermCmd');

export default new Command({
    name: 'get-uid',
    description: "Gets a person's uid using a message id from Aeon Chat",
    options:
    [{
        name: 'user-id',
        description: 'The id of the user you want to remove the permissions of.',
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    run: async (options) => {
        if (!options.interaction.guild) {
            await options.interaction.reply({ content: 'You cant use this here', ephemeral: true });
            return;
        }
        
        if(isDev(options.interaction.user) || isConductor(options.interaction.user) || isNavigator(options.interaction.user) || await isRep(options.interaction.user)) {
            if(config.suspendedPermissionUserIds.includes(options.interaction.user.id)) {
                await options.interaction.reply({content: "You can not use this currently.", flags: "Ephemeral"});
                return;
            }
            config.suspendedPermissionUserIds.push(options.args.getString("user-id") ?? "");
            await options.interaction.reply({content: "User has had their permissions removed.", flags: "Ephemeral"});
            return;
        }
        await options.interaction.reply({content: "You can not use this command.", flags: "Ephemeral"});
        return;
    }
});