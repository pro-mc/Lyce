const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a user in the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration in minutes (max 10080 for 7 days)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10080))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.editReply({ content: 'User not found in this server.' });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply({ content: 'You cannot mute this user because they have a higher or equal role.' });
        }

        if (!member.manageable) {
            return interaction.editReply({ content: 'I cannot mute this user due to insufficient permissions.' });
        }

        try {
            await member.timeout(duration * 60 * 1000, reason);
            
            const infractionId = uuidv4();
            await client.db.addInfraction(infractionId, user.id, interaction.user.id, 'mute', reason, duration * 60);
            
            const embed = {
                color: client.config.bot.color,
                title: 'User Muted',
                fields: [
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Duration', value: `${duration} minutes`, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Case ID', value: infractionId, inline: true }
                ],
                timestamp: new Date(),
                footer: { text: client.config.bot.name }
            };

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Failed to mute the user.' });
        }
    }
};
