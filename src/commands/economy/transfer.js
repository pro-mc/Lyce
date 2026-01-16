const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Transfer Lycecoins to another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to transfer to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to transfer')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction, client) {
        await interaction.deferReply();

        const senderId = interaction.user.id;
        const receiver = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (receiver.bot) {
            return interaction.editReply({ content: 'You cannot transfer coins to bots.' });
        }

        if (receiver.id === senderId) {
            return interaction.editReply({ content: 'You cannot transfer coins to yourself.' });
        }

        await client.db.createUser(senderId, interaction.user.username, interaction.user.discriminator);
        await client.db.createUser(receiver.id, receiver.username, receiver.discriminator);
        
        const sender = await client.db.getUser(senderId);
        
        if (sender.balance < amount) {
            return interaction.editReply({ content: `You don't have enough Lycecoins. Your balance: ${sender.balance}` });
        }

        await client.db.updateBalance(senderId, -amount);
        await client.db.updateBalance(receiver.id, amount);
        
        const embed = {
            color: client.config.bot.color,
            title: 'Transfer Successful',
            description: `You transferred **${amount} Lycecoins** to ${receiver.username}`,
            fields: [
                { name: 'Your New Balance', value: `${sender.balance - amount} Lycecoins`, inline: true },
                { name: 'Transaction ID', value: `TX-${Date.now()}`, inline: true }
            ],
            timestamp: new Date(),
            footer: { text: client.config.bot.name }
        };

        await interaction.editReply({ embeds: [embed] });
    }
};
