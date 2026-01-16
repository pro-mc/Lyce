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
                flags: 64 
            });
        }

        await interaction.deferReply({ flags: 64 });

        const licenseKey = interaction.options.getString('license_key');
        const guildId = interaction.options.getString('guild_id');

        if (!licenseKey && !guildId) {
            return interaction.editReply({ 
                content: '❌ Please provide either a license key or guild ID.' 
            });
        }

        try {
            if (guildId) {
                const result = await client.premiumManager.revokePremium(guildId, 'manual');
                
                if (result.success) {
                    await interaction.editReply({ 
                        content: `✅ Premium access revoked for guild \`${guildId}\`` 
                    });
                } else {
                    await interaction.editReply({ 
                        content: `❌ Failed to revoke premium for guild \`${guildId}\`: ${result.message}` 
                    });
                }
            } else if (licenseKey) {
                const licenseInfo = await client.premiumManager.getLicenseInfo(licenseKey);
                
                if (!licenseInfo) {
                    return interaction.editReply({ 
                        content: '❌ License not found.' 
                    });
                }

                if (licenseInfo.activated_guild_id) {
                    const result = await client.premiumManager.revokePremium(licenseInfo.activated_guild_id, 'manual');
                    
                    if (result.success) {
                        await interaction.editReply({ 
                            content: `✅ License \`${licenseKey}\` revoked from guild \`${licenseInfo.activated_guild_id}\`` 
                        });
                    } else {
                        await interaction.editReply({ 
                            content: `❌ Failed to revoke license: ${result.message}` 
                        });
                    }
                } else {
                    await client.db.query(
                        `UPDATE premium_licenses 
                         SET status = 'revoked', 
                             updated_at = NOW() 
                         WHERE license_key = ?`,
                        [licenseKey]
                    );
                    
                    await interaction.editReply({ 
                        content: `✅ Inactive license \`${licenseKey}\` has been revoked.` 
                    });
                }
            }
        } catch (error) {
            console.error('Error revoking license:', error);
            await interaction.editReply({ 
                content: `❌ Error revoking license: ${error.message}` 
            });
        }
    }
};
