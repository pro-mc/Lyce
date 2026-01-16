const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('Check premium status and features'),

    async execute(interaction, client) {
        // Defer immediately
        await interaction.deferReply();

        try {
            // Check if premiumManager exists
            if (!client.premiumManager) {
                return interaction.editReply({ 
                    content: '❌ Premium system is not initialized. Please contact the bot administrator.' 
                });
            }

            const status = await client.premiumManager.checkPremiumStatus(interaction.guild.id);
            
            const embed = new EmbedBuilder()
                .setColor(status.isPremium ? client.config.bot.color : 0x888888)
                .setTitle(status.isPremium ? '🎉 Premium Active' : 'Free Tier')
                .setTimestamp()
                .setFooter({ text: client.config.bot.name });

            if (status.isPremium) {
                embed.setDescription(`**${status.tier.toUpperCase()} PREMIUM**\nEnjoy all premium features!`);
                
                const features = status.features ? 
                    status.features.map(f => `✅ ${f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`).join('\n') : 
                    'No features found';
                
                embed.addFields(
                    { name: 'Features', value: features },
                    { name: 'Activated', value: status.activatedAt ? new Date(status.activatedAt).toLocaleDateString() : 'N/A', inline: true },
                    { name: 'Expires', value: status.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : 'Never', inline: true }
                );
            } else {
                embed.setDescription('This server is on the **Free Tier**. Upgrade to unlock premium features!');
                
                embed.addFields(
                    { name: 'Free Features', value: '• 5 Moderation Commands\n• 3 Economy Activities\n• Basic Auto-Mod\n• 100 Message Purge Limit\n• Server Leaderboard' },
                    { name: 'Premium Features', value: '• Unlimited Auto-Mod\n• Advanced Raid Protection\n• 8+ Economy Activities\n• Global Leaderboard\n• Web Dashboard\n• Custom Commands\n• And much more!' },
                    { name: 'Upgrade', value: 'Visit our website or use `/buy` to purchase premium' }
                );
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in premium command:', error);
            await interaction.editReply({ 
                content: `❌ Error checking premium status: ${error.message}` 
            });
        }
    }
};
