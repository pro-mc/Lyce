const { SlashCommandBuilder } = require('discord.js');
const config = require('../../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revokelicense')
        .setDescription('Revoke a premium license (Owner only)')
        .addStringOption(option =>
            option.setName('license_key')
                .setDescription('License key to revoke')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('guild_id')
                .setDescription('Guild ID to revoke premium from')
                .setRequired(false)),

    async execute(interaction, client) {
        if (interaction.user.id !== config.ownerId) {
            return interaction.reply({ 
                content: '❌ This command is restricted to the bot owner.', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const licenseKey = interaction.options.getString('license_key');
        const guildId = interaction.options.getString('guild_id');

        if (!licenseKey && !guildId) {
            return interaction.editReply({ 
                content: 'Please provide either a license key or guild ID.' 
            });
        }

        try {
            if (guildId) {
                const result = await client.premiumManager.revokeLicense(guildId);
                await interaction.editReply({ content: result.message });
            } else if (licenseKey) {
                const licenseInfo = await client.premiumManager.getLicenseInfo(licenseKey);
                if (!licenseInfo || !licenseInfo.license.activated_guild_id) {
                    return interaction.editReply({ content: 'License not found or not activated.' });
                }

                await client.premiumManager.revokeLicense(licenseInfo.license.activated_guild_id);
                await client.db.query(
                    `UPDATE premium_licenses SET status = 'revoked' WHERE license_key = ?`,
                    [licenseKey]
                );

                await interaction.editReply({ 
                    content: `✅ License ${licenseKey} revoked from guild ${licenseInfo.license.activated_guild_id}` 
                });
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Error revoking license.' });
        }
    }
};
