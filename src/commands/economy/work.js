const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn Lycecoins'),

    async execute(interaction, client) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        const now = Date.now();
        
        await client.db.createUser(userId, interaction.user.username, interaction.user.discriminator);
        
        const user = await client.db.getUser(userId);
        
        if (user.last_work) {
            const lastWork = new Date(user.last_work).getTime();
            const cooldown = client.config.features.workCooldown;
            
            if (now - lastWork < cooldown) {
                const remaining = cooldown - (now - lastWork);
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                
                return interaction.editReply({ 
                    content: `You need to wait ${minutes}m ${seconds}s before working again!` 
                });
            }
        }

        const jobs = [
            'Discord Moderator', 'Bot Developer', 'Community Manager', 
            'Server Administrator', 'Content Creator', 'Game Developer',
            'Security Analyst', 'Network Engineer', 'UX Designer'
        ];
        
        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const earnings = Math.floor(Math.random() * 41) + 10;
        
        await client.db.updateBalance(userId, earnings);
        await client.db.query(
            'UPDATE users SET last_work = NOW() WHERE id = ?',
            [userId]
        );
        
        const embed = {
            color: client.config.bot.color,
            title: 'Work Completed',
            description: `You worked as a **${job}** and earned **${earnings} Lycecoins**!`,
            fields: [
                { name: 'New Balance', value: `${user.balance + earnings} Lycecoins`, inline: true },
                { name: 'Next Work In', value: '1 hour', inline: true }
            ],
            timestamp: new Date(),
            footer: { text: client.config.bot.name }
        };

        await interaction.editReply({ embeds: [embed] });
    }
};
