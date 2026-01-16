const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn Lycecoins')
        .addStringOption(option =>
            option.setName('job')
                .setDescription('Choose a job (Premium only)')
                .setRequired(false)
                .addChoices(
                    { name: 'Basic Job', value: 'basic' },
                    { name: 'Developer', value: 'developer' },
                    { name: 'Manager', value: 'manager' },
                    { name: 'Security', value: 'security' }
                )),

    async execute(interaction, client) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const selectedJob = interaction.options.getString('job') || 'basic';
        
        await client.db.createUser(userId, interaction.user.username, interaction.user.discriminator);
        
        const user = await client.db.getUser(userId);
        const now = Date.now();
        
        if (user.last_work) {
            const lastWork = new Date(user.last_work).getTime();
            const cooldown = client.config.features.workCooldown;
            
            if (now - lastWork < cooldown) {
                const remaining = cooldown - (now - lastWork);
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                
                return interaction.editReply({ 
                    embeds: [{
                        color: 0xff9900,
                        title: '⏰ Cooldown Active',
                        description: `You need to wait **${minutes}m ${seconds}s** before working again!`,
                        footer: { text: 'Tip: Premium users get shorter cooldowns' }
                    }]
                });
            }
        }

        if (selectedJob !== 'basic') {
            const isPremium = await client.premiumManager.hasFeature(
                guildId,
                'premium_economy_activities'
            );

            if (!isPremium) {
                return interaction.editReply({
                    embeds: [{
                        color: 0xff9900,
                        title: '🔒 Premium Feature',
                        description: 'Specialized jobs are available for premium servers only!',
                        fields: [
                            { name: 'Premium Benefits', value: '• Higher paying jobs\n• Shorter cooldowns\n• Job bonuses\n• Special rewards' },
                            { name: 'Upgrade', value: 'Server owner can use `/buy` to purchase premium' }
                        ]
                    }]
                });
            }
        }

        const isPremium = await client.premiumManager.hasFeature(
            guildId,
            'premium_economy_activities'
        );

        let baseEarnings, jobName, cooldownReduction = 0;

        if (isPremium) {
            const premiumJobs = {
                basic: { name: 'Basic Labor', min: 20, max: 60, bonus: 0 },
                developer: { name: 'Bot Developer', min: 50, max: 150, bonus: 25 },
                manager: { name: 'Community Manager', min: 40, max: 120, bonus: 20 },
                security: { name: 'Security Analyst', min: 60, max: 180, bonus: 30 }
            };
            
            const job = premiumJobs[selectedJob] || premiumJobs.basic;
            jobName = job.name;
            baseEarnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
            cooldownReduction = 0.5;
        } else {
            jobName = 'Basic Job';
            baseEarnings = Math.floor(Math.random() * 41) + 10;
        }

        const streak = user.daily_streak || 0;
        const streakBonus = Math.floor(streak / 7) * 5;
        
        const premiumBonus = isPremium ? Math.floor(baseEarnings * 0.25) : 0;
        
        const totalEarnings = baseEarnings + streakBonus + premiumBonus;

        await client.db.updateBalance(userId, totalEarnings);
        await client.db.query(
            'UPDATE users SET last_work = NOW() WHERE id = ?',
            [userId]
        );

        const embed = {
            color: isPremium ? 0x00ff00 : client.config.bot.color,
            title: isPremium ? '💼 Premium Job Complete!' : '💼 Work Complete',
            description: `You worked as a **${jobName}** and earned **${totalEarnings} Lycecoins**!`,
            fields: [
                { name: 'Base Earnings', value: `${baseEarnings} coins`, inline: true },
                { name: 'New Balance', value: `${(user.balance || 0) + totalEarnings} coins`, inline: true }
            ],
            timestamp: new Date(),
            footer: { text: client.config.bot.name }
        };

        if (streakBonus > 0) {
            embed.fields.push({ name: 'Streak Bonus', value: `+${streakBonus} coins`, inline: true });
        }

        if (premiumBonus > 0) {
            embed.fields.push({ name: 'Premium Bonus', value: `+${premiumBonus} coins`, inline: true });
        }

        if (isPremium) {
            embed.fields.push({ 
                name: 'Next Work In', 
                value: '30 minutes (Premium)', 
                inline: true 
            });
        } else {
            embed.fields.push({ 
                name: 'Next Work In', 
                value: '1 hour', 
                inline: true 
            });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
