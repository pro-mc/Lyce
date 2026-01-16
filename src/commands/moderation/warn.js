const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user in the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.editReply({ content: 'User not found in this server.' });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply({ content: 'You cannot warn this user because they have a higher or equal role.' });
        }

        try {
            const infractionId = uuidv4();
            await client.db.addInfraction(infractionId, user.id, interaction.user.id, 'warn', reason);
            
            const userWarnings = await client.db.getInfractions(user.id);
            const warningCount = userWarnings.filter(w => w.type === 'warn' && w.active).length;
            
            const embed = {
                color: client.config.bot.color,
                title: 'User Warned',
                fields: [
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Warnings', value: `${warningCount}/3`, inline: true },
                    { name: 'Case ID', value: infractionId, inline: true }
                ],
                timestamp: new Date(),
                footer: { text: client.config.bot.name }
            };

            if (warningCount >= 3) {
                embed.fields.push({ name: '⚠️ Action Required', value: 'User has reached 3 warnings! Consider taking further action.', inline: false });
            }

            await interaction.editReply({ embeds: [embed] });
            
            try {
                await user.send({
                    embeds: [{
                        color: 0xff9900,
                        title: 'You have been warned',
                        description: `You received a warning in **${interaction.guild.name}**`,
                        fields: [
                            { name: 'Reason', value: reason },
                            { name: 'Warning Count', value: `${warningCount}/3` },
                            { name: 'Case ID', value: infractionId }
                        ],
                        timestamp: new Date()
                    }]
                });
            } catch (dmError) {
                console.log('Could not send DM to user');
            }
            
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Failed to warn the user.' });
        }
    }
};
