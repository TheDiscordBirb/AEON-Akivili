import { Command } from '../../structures/command';
import { isNavigator, } from '../../utils';
import { Logger } from '../../logger';
import { config } from '../../const';

const logger = new Logger('CrowdControlCmd');

export default new Command({
    name: 'crowd-control',
    description: 'Enables/Disables crowd control.',
    options: [],

    run: async (options) => {
        if (!options.interaction.member) {
            await options.interaction.reply({ content: `You cant use this command outside a server.`, ephemeral: true });
            logger.warn(`Didnt get interaction member`);
            return;
        }
        if (!isNavigator(options.interaction.user)) {
            await options.interaction.reply({ content: `You do not have permission to use this!`, ephemeral: true });
            return;
        }

        config.crowdControlActive = !config.crowdControlActive;
    
        await options.interaction.reply({content: `Crowd control has been set to ${config.crowdControlActive ? "active" : "inactive"}`, ephemeral: true});
    }
});