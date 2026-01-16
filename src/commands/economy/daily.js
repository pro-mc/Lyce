const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily Lycecoins'),

    async execute(interaction, client) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        
        await client.db.createUser(userId, interaction.user.username, interaction.user.discriminator);
        
        const user = await client.db.getUser(userId);
        const now = new Date();
        const lastDaily = user.last_daily ? new Date(user.last_daily) : null;
        
        const dailyReward = client.config.features.dailyReward;
        
        if (lastDaily) {
            const timeDiff = now - lastDaily;
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            if (hoursDiff < 24) {
                const nextDaily = new Date(lastDaily.getTime() + 24 * 60 * 60 * 1000);
                const remaining = nextDaily - now;
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                
                return interaction.editReply({ 
                    content: `You can claim your next daily reward in ${hours}h ${minutes}m!` 
                });
            }
            
            const isConsecutive = lastDaily.getDate() === now.getDate() - 1 || 
                                 (lastDaily.getMonth() === now.getMonth() - 1 && 
                                  lastDaily.getDate() === new Date(lastDaily.getFullYear(), lastDaily.getMonth() + 1, 0).getDate());
            
            let streak = user.daily_streak || 0;
            let bonus = 0;
            
            if (isConsecutive) {
                streak++;
                bonus = Math.floor(streak / 7) * 50;
            } else {
                streak = 1;
            }
            
            const totalEarnings = dailyReward + bonus;
            
            await client.db.updateBalance(userId, totalEarnings);
            await client.db.query(
                'UPDATE users SET last_daily = NOW(), daily_streak = ? WHERE id = ?',
                [streak, userId]
            );
            
            const embed = {
                color: client.config.bot.color,
                title: 'Daily Reward Claimed',
                description: `You claimed **${totalEarnings} Lycecoins**!`,
                fields: [
                    { name: 'Base Reward', value: `${dailyReward} Lycecoins`, inline: true },
                    { name: 'Current Streak', value: `${streak} days`, inline: true },
                    { name: 'Streak Bonus', value: `${bonus} Lycecoins`, inline: true },
                    { name: 'New Balance', value: `${user.balance + totalEarnings} Lycecoins`, inline: true }
                ],
                timestamp: new Date(),
                footer: { text: client.config.bot.name }
            };
            
            await interaction.editReply({ embeds: [embed] });
            
        } else {
            await client.db.updateBalance(userId, dailyReward);
            await client.db.query(
                'UPDATE users SET last_daily = NOW(), daily_streak = 1 WHERE id = ?',
                [userId]
            );
            
            const embed = {
                color: client.config.bot.color,
                title: 'Daily Reward Claimed',
                description: `You claimed **${dailyReward} Lycecoins**!`,
                fields: [
                    { name: 'New Balance', value: `${user.balance + dailyReward} Lycecoins`, inline: true },
                    { name: 'Current Streak', value: '1 day', inline: true }
                ],
                timestamp: new Date(),
                footer: { text: client.config.bot.name }
            };
            
            await interaction.editReply({ embeds: [embed] });
        }
    }
};
