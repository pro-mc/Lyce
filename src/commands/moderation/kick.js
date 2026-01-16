const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.editReply({ content: 'User not found in this server.' });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply({ content: 'You cannot kick this user because they have a higher or equal role.' });
        }

        if (!member.kickable) {
            return interaction.editReply({ content: 'I cannot kick this user due to insufficient permissions.' });
        }

        try {
            await member.kick(reason);
            
            const infractionId = uuidv4();
            await client.db.addInfraction(infractionId, user.id, interaction.user.id, 'kick', reason);
            
            const embed = {
                color: client.config.bot.color,
                title: 'User Kicked',
                fields: [
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Case ID', value: infractionId, inline: true }
                ],
                timestamp: new Date(),
                footer: { text: client.config.bot.name }
            };

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Failed to kick the user.' });
        }
    }
};
