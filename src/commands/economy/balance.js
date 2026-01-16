const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your Lycecoin balance')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check another user\'s balance')
                .setRequired(false)),

    async execute(interaction, client) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
        
        await client.db.createUser(userId, targetUser.username, targetUser.discriminator);
        
        const user = await client.db.getUser(userId);
        
        const embed = {
            color: client.config.bot.color,
            title: `${targetUser.username}'s Balance`,
            thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) },
            fields: [
                { name: 'Lycecoins', value: `${user.balance || 0}`, inline: true },
                { name: 'Daily Streak', value: `${user.daily_streak || 0} days`, inline: true }
            ],
            timestamp: new Date(),
            footer: { text: client.config.bot.name }
        };

        if (targetUser.id === interaction.user.id) {
            embed.description = 'Your current balance and statistics';
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
