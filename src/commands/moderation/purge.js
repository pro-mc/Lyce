const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete multiple messages')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(50000))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Delete messages from specific user')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('contains')
                .setDescription('Delete messages containing text (Premium)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('starts_with')
                .setDescription('Delete messages starting with text (Premium)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('pinned')
                .setDescription('Include pinned messages (Premium)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const amount = interaction.options.getInteger('amount');
        const user = interaction.options.getUser('user');
        const contains = interaction.options.getString('contains');
        const startsWith = interaction.options.getString('starts_with');
        const includePinned = interaction.options.getBoolean('pinned') || false;
        const guildId = interaction.guild.id;

        const isPremium = await client.premiumManager.hasFeature(
            guildId,
            'bulk_purge_50000'
        );

        const maxFreeAmount = client.config.features.maxFreePurge;
        const maxPremiumAmount = client.config.features.premiumPurgeLimit;

        const hasAdvancedFilters = contains || startsWith || includePinned;
        if (hasAdvancedFilters && !isPremium) {
            return interaction.editReply({
                embeds: [{
                    color: 0xff9900,
                    title: '🔒 Premium Feature',
                    description: 'Advanced message filtering is available for premium servers only!',
                    fields: [
                        { name: 'Premium Filters', value: '• Filter by content\n• Filter by starting text\n• Include/exclude pinned\n• Regex filtering\n• User role filtering' },
                        { name: 'Purge Limit', value: `${maxPremiumAmount} messages`, inline: true },
                        { name: 'Price', value: '$4.99/month', inline: true },
                        { name: 'Get Premium', value: 'Server owner use `/buy`', inline: true }
                    ]
                }]
            });
        }

        if (!isPremium && amount > maxFreeAmount) {
            return interaction.editReply({
                embeds: [{
                    color: 0xff9900,
                    title: '⚠️ Free Tier Limit',
                    description: `Free servers can only purge up to **${maxFreeAmount}** messages at once.`,
                    fields: [
                        { name: 'Premium Limit', value: `${maxPremiumAmount} messages`, inline: true },
                        { name: 'Other Premium Features', value: '• Advanced auto-mod\n• Raid protection\n• Web dashboard\n• Custom commands' },
                        { name: 'Upgrade Now', value: 'Use `/premium` to see all features' }
                    ]
                }]
            });
        }

        const actualMax = isPremium ? Math.min(amount, maxPremiumAmount) : Math.min(amount, maxFreeAmount);

        try {
            let deletedCount = 0;
            
            if (hasAdvancedFilters && isPremium) {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                let toDelete = [];
                
                for (const [id, msg] of messages) {
                    if (toDelete.length >= actualMax) break;
                    
                    if (user && msg.author.id !== user.id) continue;
                    
                    if (contains && !msg.content.includes(contains)) continue;
                    
                    if (startsWith && !msg.content.startsWith(startsWith)) continue;
                    
                    if (!includePinned && msg.pinned) continue;
                    
                    toDelete.push(msg);
                }
                
                if (toDelete.length > 0) {
                    const deleted = await interaction.channel.bulkDelete(toDelete, true);
                    deletedCount = deleted.size;
                }
            } else if (user) {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const userMessages = messages.filter(m => m.author.id === user.id).first(actualMax);
                
                if (userMessages.length > 0) {
                    const deleted = await interaction.channel.bulkDelete(userMessages, true);
                    deletedCount = deleted.size;
                }
            } else {
                const deleted = await interaction.channel.bulkDelete(actualMax, true);
                deletedCount = deleted.size;
            }

            const embed = {
                color: isPremium ? 0x00ff00 : client.config.bot.color,
                title: `✅ ${isPremium ? 'Premium Purge' : 'Messages Purged'}`,
                description: `Successfully deleted **${deletedCount}** messages${user ? ` from ${user.tag}` : ''}`,
                fields: [
                    { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true }
                ],
                timestamp: new Date(),
                footer: { text: isPremium ? '🔒 Premium Feature' : client.config.bot.name }
            };

            if (deletedCount === 0) {
                embed.description = 'No messages found matching your criteria.';
                embed.color = 0xff9900;
            }

            if (isPremium && hasAdvancedFilters) {
                embed.fields.push({ 
                    name: 'Filters Applied', 
                    value: `${contains ? `Contains: "${contains}"\n` : ''}${startsWith ? `Starts with: "${startsWith}"\n` : ''}${includePinned ? 'Included pinned' : ''}`,
                    inline: false 
                });
            }

            const reply = await interaction.editReply({ embeds: [embed] });
            
            setTimeout(() => {
                reply.delete().catch(() => {});
            }, 5000);

        } catch (error) {
            console.error('Purge error:', error);
            
            if (error.code === 50034) {
                await interaction.editReply({
                    embeds: [{
                        color: 0xff0000,
                        title: '❌ Cannot Delete Old Messages',
                        description: 'Messages older than 14 days cannot be bulk deleted.',
                        fields: [
                            { name: 'Solution', value: 'Try deleting fewer messages or use other criteria.' }
                        ]
                    }]
                });
            } else {
                await interaction.editReply({
                    embeds: [{
                        color: 0xff0000,
                        title: '❌ Purge Failed',
                        description: error.message || 'An error occurred while deleting messages.',
                        fields: [
                            { name: 'Common Issues', value: '• Bot lacks permissions\n• Rate limited\n• Invalid amount' }
                        ]
                    }]
                });
            }
        }
    }
};
