const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Beg for Lycecoins from strangers'),

    async execute(interaction, client) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        const now = Date.now();
        
        await client.db.createUser(userId, interaction.user.username, interaction.user.discriminator);
        
        const user = await client.db.getUser(userId);
        
        if (user.last_beg) {
            const lastBeg = new Date(user.last_beg).getTime();
            const cooldown = client.config.features.begCooldown;
            
            if (now - lastBeg < cooldown) {
                const remaining = cooldown - (now - lastBeg);
                const seconds = Math.floor(remaining / 1000);
                
                return interaction.editReply({ 
                    content: `You need to wait ${seconds}s before begging again!` 
                });
            }
        }

        const successRate = 0.7;
        const isSuccess = Math.random() < successRate;
        
        if (isSuccess) {
            const earnings = Math.floor(Math.random() * 21) + 5;
            
            await client.db.updateBalance(userId, earnings);
            await client.db.query(
                'UPDATE users SET last_beg = NOW() WHERE id = ?',
                [userId]
            );
            
            const responses = [
                "A kind stranger gave you",
                "You managed to beg",
                "Someone took pity and gave you",
                "You received a donation of"
            ];
            
            const response = responses[Math.floor(Math.random() * responses.length)];
            
            const embed = {
                color: client.config.bot.color,
                title: 'Begging Successful',
                description: `${response} **${earnings} Lycecoins**!`,
                fields: [
                    { name: 'New Balance', value: `${user.balance + earnings} Lycecoins`, inline: true }
                ],
                timestamp: new Date(),
                footer: { text: client.config.bot.name }
            };

            await interaction.editReply({ embeds: [embed] });
        } else {
            await client.db.query(
                'UPDATE users SET last_beg = NOW() WHERE id = ?',
                [userId]
            );
            
            const failures = [
                "No one gave you anything today.",
                "People ignored your begging.",
                "You got caught by security!",
                "Everyone walked past you."
            ];
            
            const failure = failures[Math.floor(Math.random() * failures.length)];
            
            await interaction.editReply({ 
                content: `❌ ${failure} Try again in 30 seconds.` 
            });
        }
    }
};
