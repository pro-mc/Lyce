const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('activate')
        .setDescription('Activate a premium license for this server')
        .addStringOption(option =>
            option.setName('license_key')
                .setDescription('Your license key (e.g., MON-XXXX-XXXX)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const licenseKey = interaction.options.getString('license_key');
        const result = await client.premiumManager.activateLicense(
            interaction.guild.id,
            licenseKey,
            interaction.user.id
        );

        const embed = {
            color: result.success ? client.config.bot.color : 0xff0000,
            title: result.success ? '✅ License Activated' : '❌ Activation Failed',
            description: result.message,
            timestamp: new Date(),
            footer: { text: client.config.bot.name }
        };

        if (result.success) {
            embed.fields = [
                { name: 'Premium Tier', value: result.tier, inline: true },
                { name: 'Expires', value: result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : 'Never', inline: true },
                { name: 'Features Unlocked', value: result.features.length.toString(), inline: true }
            ];

            // Send welcome message to general chat if possible
            try {
                const generalChannel = interaction.guild.channels.cache.find(
                    ch => ch.type === 0 && ch.permissionsFor(interaction.guild.members.me).has('SendMessages')
                );
                
                if (generalChannel) {
                    await generalChannel.send({
                        embeds: [{
                            color: client.config.bot.color,
                            title: '🎉 Premium Activated!',
                            description: `**${interaction.guild.name}** has been upgraded to **${result.tier} Premium**!`,
                            fields: [
                                { name: 'Activated By', value: interaction.user.tag },
                                { name: 'New Features', value: 'Check `/premium` for all unlocked features' }
                            ],
                            timestamp: new Date()
                        }]
                    });
                }
            } catch (error) {
                console.error('Failed to send premium announcement:', error);
            }
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
