const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);
            
            if (error.code === 10062) {
                console.log(`Interaction ${interaction.id} expired/timed out for command ${interaction.commandName}`);
                return;
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Command Error')
                .setDescription('There was an error while executing this command!')
                .addFields(
                    { name: 'Error', value: error.message.substring(0, 1000) }
                )
                .setTimestamp();
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ 
                        embeds: [errorEmbed], 
                        flags: 64
                    });
                } else {
                    await interaction.reply({ 
                        embeds: [errorEmbed], 
                        flags: 64
                    });
                }
            } catch (replyError) {
                if (replyError.code !== 40060) {
                    console.error('Failed to send error message:', replyError);
                }
            }
        }
    }
}
