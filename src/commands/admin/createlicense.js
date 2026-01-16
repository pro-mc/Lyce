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
                    name: 'Lifetime', value: 'lifetime' }
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
                flags: 64 // Use MessageFlags.Ephemeral
            });
        }

        // Defer immediately to prevent timeout
        await interaction.deferReply({ flags: 64 });

        const tier = interaction.options.getString('tier');
        const user = interaction.options.getUser('user');
        
        // Check if premiumManager exists
        if (!client.premiumManager) {
            return interaction.editReply({ 
                content: '❌ Premium system is not initialized. Please contact the bot administrator.' 
            });
        }

        try {
            const license = await client.premiumManager.createLicense(
                tier, 
                user ? user.id : null
            );

            const embed = {
                color: client.config.bot.color,
                title: '✅ License Created',
                fields: [
                    { name: 'License Key', value: `\`${license.licenseKey}\`` },
                    { name: 'Tier', value: tier.charAt(0).toUpperCase() + tier.slice(1) },
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
                            description: `Here is your ${tier} license for Lyce Bot`,
                            fields: [
                                { name: 'License Key', value: `\`${license.licenseKey}\`` },
                                { name: 'Activation', value: 'Use `/activate` in your server with this key' },
                                { name: 'Tier', value: tier.charAt(0).toUpperCase() + tier.slice(1) }
                            ],
                            footer: { text: 'Keep this key secure!' }
                        }]
                    });
                    await interaction.followUp({ 
                        content: `✅ License also sent to ${user.tag}`,
                        flags: 64 
                    });
                } catch (error) {
                    console.error('Failed to DM user:', error);
                    await interaction.followUp({
                        content: `⚠️ Could not DM ${user.tag}. License key: ${license.licenseKey}`,
                        flags: 64
                    });
                }
            }
        } catch (error) {
            console.error('Error creating license:', error);
            await interaction.editReply({ 
                content: `❌ Failed to create license: ${error.message}` 
            });
        }
    }
};
