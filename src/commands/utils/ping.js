const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fixTables } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Check the bot's latency"),

    async execute(interaction, client) {
        const sent = await interaction.reply({ 
            content: '🏓 Pinging...', 
            fetchReply: true,
            ephemeral: fixTables
        });
        
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        
        const embed = new EmbedBuilder()
            .setColor(client.config.bot.color || 3447003)
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
        
        await interaction.editReply({ 
            content: null,
            embeds: [embed] 
        });
    }
};
