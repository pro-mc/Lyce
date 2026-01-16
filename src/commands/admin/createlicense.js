const { SlashCommandBuilder } = require('discord.js');
const config = require('../../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createlicense')
        .setDescription('Create a new premium license (Owner only)')
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('License tier')
                .setRequired(true)
                .addChoices(
                    { name: 'Monthly', value: 'monthly' },
                    { name: 'Yearly', value: 'yearly' },
                    { name: 'Lifetime', value: 'lifetime' }
                ))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to assign license to (optional)')
                .setRequired(false)),

    async execute(interaction, client) {
        // Check if user is owner
        if (interaction.user.id !== config.ownerId) {
            return interaction.reply({ 
                content: '❌ This command is restricted to the bot owner.', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const tier = interaction.options.getString('tier');
        const user = interaction.options.getUser('user');
        const tierData = client.premiumManager.features[tier];

        const license = await client.premiumManager.createLicense(
            tier, 
            user ? user.id : null
        );

        const embed = {
            color: client.config.bot.color,
            title: '✅ License Created',
            fields: [
                { name: 'License Key', value: `\`${license.licenseKey}\`` },
                { name: 'Tier', value: license.tier },
                { name: 'Price', value: `$${license.price}` },
                { name: 'Status', value: 'Inactive (Ready for activation)' }
            ],
            timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });

        // Send license to user if specified
        if (user) {
            try {
                await user.send({
                    embeds: [{
                        color: client.config.bot.color,
                        title: 'Your Premium License',
                        description: `Here is your ${license.tier} license for Lyce Bot`,
                        fields: [
                            { name: 'License Key', value: `\`${license.licenseKey}\`` },
                            { name: 'Activation', value: 'Use `/activate` in your server with this key' },
                            { name: 'Value', value: `$${license.price}` }
                        ],
                        footer: { text: 'Keep this key secure!' }
                    }]
                });
                await interaction.followUp({ 
                    content: `✅ License also sent to ${user.tag}`,
                    ephemeral: true 
                });
            } catch (error) {
                await interaction.followUp({
                    content: `⚠️ Could not DM ${user.tag}. License key: ${license.licenseKey}`,
                    ephemeral: true
                });
            }
        }
    }
};
