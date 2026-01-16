const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show Lycecoin leaderboards')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Leaderboard type')
                .setRequired(false)
                .addChoices(
                    { name: 'Server', value: 'server' },
                    { name: 'Global (Premium)', value: 'global' }
                )),

    async execute(interaction, client) {
        await interaction.deferReply();

        const type = interaction.options.getString('type') || 'server';
        const guildId = interaction.guild.id;

        // Check for global leaderboard (premium feature)
        if (type === 'global') {
            const isPremium = await client.premiumManager.hasFeature(
                guildId,
                'global_leaderboard'
            );

            if (!isPremium) {
                return interaction.editReply({
                    embeds: [{
                        color: 0xff9900,
                        title: '🔒 Premium Feature',
                        description: 'Global leaderboard is available for premium servers only!',
                        fields: [
                            { name: 'Premium Benefits', value: '• Global rankings\n• Advanced statistics\n• More leaderboard types' },
                            { name: 'Upgrade', value: 'Server owner can use `/buy` to purchase premium' }
                        ]
                    }]
                });
            }
        }

        let title, description, users;

        if (type === 'server') {
            users = await client.db.query(
                `SELECT u.id, u.username, u.discriminator, u.balance 
                 FROM users u
                 JOIN server_settings s ON s.guild_id = ?
                 ORDER BY u.balance DESC 
                 LIMIT 10`,
                [guildId]
            );
            title = '🏆 Server Leaderboard';
            description = 'Top earners in this server';
        } else {
            users = await client.db.query(
                `SELECT u.id, u.username, u.discriminator, u.balance 
                 FROM users u
                 ORDER BY u.balance DESC 
                 LIMIT 10`
            );
            title = '🌍 Global Leaderboard';
            description = 'Top earners across all servers';
        }

        if (users.length === 0) {
            return interaction.editReply({ 
                content: 'No users found in the leaderboard.' 
            });
        }

        const embed = new EmbedBuilder()
            .setColor(client.config.bot.color)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ 
                text: type === 'global' ? '🔒 Premium Feature' : client.config.bot.name 
            });

        let descriptionText = '';
        
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔸';
            
            descriptionText += `${medal} **${i + 1}.** ${user.username}#${user.discriminator}\n💰 **${user.balance}** Lycecoins\n`;
            
            if (i < users.length - 1) descriptionText += '\n';
        }

        embed.setDescription(descriptionText);

        await interaction.editReply({ embeds: [embed] });
    }
};
