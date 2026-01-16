const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Check the bot's latency"),

    async execute(interaction, client) {
        // Send initial reply
        const sent = await interaction.reply({ 
            content: '🏓 Pinging...', 
            fetchReply: true,
            ephemeral: false // Change to false to make it visible
        });
        
        // Calculate latency
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor(client.config.bot.color || 3447003) // Use config color or default
            .setTitle('🏓 Pong!')
            .addFields(
                { 
                    name: 'Bot Latency', 
                    value: `\`${latency}ms\``, 
                    inline: true 
                },
                { 
                    name: 'API Latency', 
                    value: `\`${apiLatency}ms\``, 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ 
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL() 
            });
        
        // Edit the original reply with the embed
        await interaction.editReply({ 
            content: null, // Remove the "Pinging..." text
            embeds: [embed] 
        });
    }
};
