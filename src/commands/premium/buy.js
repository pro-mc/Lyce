const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Purchase premium for this server')
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('Select premium tier')
                .setRequired(true)
                .addChoices(
                    { name: 'Monthly - $4.99/month', value: 'monthly' },
                    { name: 'Yearly - $49.99/year', value: 'yearly' },
                    { name: 'Lifetime - $60 (one-time)', value: 'lifetime' }
                )),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const tier = interaction.options.getString('tier');
        const tierData = client.premiumManager.features[tier];

        const embed = new EmbedBuilder()
            .setColor(client.config.bot.color)
            .setTitle(`Purchase ${tierData.name} Premium`)
            .setDescription(`**$${tierData.price}** ${tier === 'lifetime' ? '(One-time payment)' : tier === 'yearly' ? '/year' : '/month'}`)
            .addFields(
                { name: 'Features Included', value: tierData.features.map(f => `• ${f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`).join('\n') },
                { name: 'Duration', value: tier === 'lifetime' ? 'Lifetime' : tier === 'yearly' ? '1 Year' : '30 Days', inline: true },
                { name: 'Auto-Renew', value: tier === 'lifetime' ? 'No' : 'Yes', inline: true }
            )
            .setFooter({ text: 'After payment, you will receive a license key via DM' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Purchase Now')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://your-website.com/purchase?tier=${tier}&guild=${interaction.guild.id}`),
                new ButtonBuilder()
                    .setLabel('View Features')
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId('view_features')
            );

        await interaction.editReply({ 
            embeds: [embed], 
            components: [row],
            ephemeral: true 
        });
    }
};
