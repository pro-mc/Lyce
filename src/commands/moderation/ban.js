const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('delete_days')
                .setDescription('Number of days of messages to delete')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(7))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const deleteDays = interaction.options.getInteger('delete_days') || 0;

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.editReply({ content: 'User not found in this server.' });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply({ content: 'You cannot ban this user because they have a higher or equal role.' });
        }

        if (!member.bannable) {
            return interaction.editReply({ content: 'I cannot ban this user due to insufficient permissions.' });
        }

        try {
            await member.ban({ reason: reason, deleteMessageDays: deleteDays });
            
            const infractionId = uuidv4();
            await client.db.addInfraction(infractionId, user.id, interaction.user.id, 'ban', reason);
            
            const embed = {
                color: client.config.bot.color,
                title: 'User Banned',
                fields: [
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Messages Deleted', value: `${deleteDays} days`, inline: true },
                    { name: 'Case ID', value: infractionId, inline: true }
                ],
                timestamp: new Date(),
                footer: { text: client.config.bot.name }
            };

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Failed to ban the user.' });
        }
    }
};
