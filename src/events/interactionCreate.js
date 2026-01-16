const { EmbedBuilder } = require('discord.js');

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
            
            // Handle unknown interaction errors (timeouts)
            if (error.code === 10062) {
                console.log(`Interaction ${interaction.id} expired/timed out for command ${interaction.commandName}`);
                return; // Don't try to respond to expired interactions
            }
            
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
                // Check interaction state
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ 
                        embeds: [errorEmbed], 
                        flags: 64 // Use MessageFlags.Ephemeral
                    });
                } else {
                    await interaction.reply({ 
                        embeds: [errorEmbed], 
                        flags: 64 // Use MessageFlags.Ephemeral
                    });
                }
            } catch (replyError) {
                // Ignore "already acknowledged" errors
                if (replyError.code !== 40060) {
                    console.error('Failed to send error message:', replyError);
                }
            }
        }
    }
}
