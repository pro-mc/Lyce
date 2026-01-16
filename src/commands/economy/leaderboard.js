const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show the server\'s top Lycecoin earners'),

    async execute(interaction, client) {
        await interaction.deferReply();

        const users = await client.db.query(
            'SELECT id, username, discriminator, balance FROM users ORDER BY balance DESC LIMIT 10'
        );

        if (users.length === 0) {
            return interaction.editReply({ content: 'No users found in the leaderboard.' });
        }

        const embed = new EmbedBuilder()
            .setColor(client.config.bot.color)
            .setTitle('🏆 Server Leaderboard')
            .setDescription('Top Lycecoin earners in this server')
            .setTimestamp()
            .setFooter({ text: client.config.bot.name });

        let description = '';
        
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔸';
            
            description += `${medal} **${i + 1}.** ${user.username}#${user.discriminator} - **${user.balance}** Lycecoins\n`;
        }

        embed.setDescription(description);

        await interaction.editReply({ embeds: [embed] });
    }
};
