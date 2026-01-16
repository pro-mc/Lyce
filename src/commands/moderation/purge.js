const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete multiple messages at once')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100 for free, up to 50000 for premium)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(50000))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Only delete messages from this user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const amount = interaction.options.getInteger('amount');
        const user = interaction.options.getUser('user');
        
        const isPremium = false; // Replace with actual premium check
        const maxFreeAmount = client.config.features.maxFreePurge;
        const maxPremiumAmount = client.config.features.premiumPurgeLimit;

        if (!isPremium && amount > maxFreeAmount) {
            return interaction.editReply({ 
                content: `Free tier is limited to ${maxFreeAmount} messages. Upgrade to premium for up to ${maxPremiumAmount} messages.` 
            });
        }

        const maxAmount = isPremium ? Math.min(amount, maxPremiumAmount) : Math.min(amount, maxFreeAmount);

        try {
            let messages;
            if (user) {
                messages = await interaction.channel.messages.fetch({ limit: 100 });
                const userMessages = messages.filter(m => m.author.id === user.id).first(maxAmount);
                
                if (userMessages.length === 0) {
                    return interaction.editReply({ content: 'No messages found from that user in the last 100 messages.' });
                }
                
                await interaction.channel.bulkDelete(userMessages, true);
            } else {
                messages = await interaction.channel.bulkDelete(maxAmount, true);
            }

            const embed = {
                color: client.config.bot.color,
                title: 'Messages Purged',
                fields: [
                    { name: 'Amount', value: `${maxAmount} messages`, inline: true },
                    { name: 'Channel', value: interaction.channel.name, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true }
                ],
                timestamp: new Date(),
                footer: { text: client.config.bot.name }
            };

            if (user) {
                embed.fields.push({ name: 'Filtered By User', value: user.tag, inline: true });
            }

            const reply = await interaction.editReply({ embeds: [embed] });
            
            setTimeout(() => {
                reply.delete().catch(() => {});
            }, 5000);
            
        } catch (error) {
            console.error(error);
            
            if (error.code === 50034) {
                await interaction.editReply({ 
                    content: 'Cannot delete messages older than 14 days. Please try with a smaller amount or more recent messages.' 
                });
            } else {
                await interaction.editReply({ content: 'Failed to delete messages.' });
            }
        }
    }
};
