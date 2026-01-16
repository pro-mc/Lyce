const { EmbedBuilder } = require('discord.js');
const ColorHelper = require('../utils/colorHelper');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Only handle chat input commands
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            // Execute the command
            await command.execute(interaction, client);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);
            
            // Create error embed
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Command Error')
                .setDescription('There was an error while executing this command!')
                .addFields(
                    { name: 'Error', value: error.message.substring(0, 1000) }
                )
                .setTimestamp();
            
            // Try to reply to the interaction
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ 
                        embeds: [errorEmbed], 
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        embeds: [errorEmbed], 
                        ephemeral: true 
                    });
                }
            } catch (replyError) {
                console.error('Failed to send error message:', replyError);
            }
        }
    }
};
