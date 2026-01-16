const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot\'s latency'),

    async execute(interaction, client) {
        const sent = await interaction.deferReply({ fetchReply: true });
        
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        
        await interaction.editReply({
            embeds: [{
                color: client.config.bot.color,
                title: '🏓 Pong!',
                fields: [
                    { name: 'Bot Latency', value: `${latency}ms`, inline: true },
                    { name: 'API Latency', value: `${apiLatency}ms`, inline: true },
                    { name: 'Uptime', value: `${Math.floor(client.uptime / 86400000)}d ${Math.floor((client.uptime % 86400000) / 3600000)}h ${Math.floor((client.uptime % 3600000) / 60000)}m`, inline: true }
                ],
                timestamp: new Date(),
                footer: { text: client.config.bot.name }
            }]
        });
    }
};
