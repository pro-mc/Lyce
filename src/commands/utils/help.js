const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands'),

    async execute(interaction, client) {
        await interaction.deferReply();

        const embed = new EmbedBuilder()
            .setColor(client.config.bot.color)
            .setTitle('❄️ Lyce Bot Commands')
            .setDescription('A premium Discord bot with moderation and economy features')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                {
                    name: '🛡️ Moderation Commands (FREE)',
                    value: '`/ban` - Ban users\n`/kick` - Kick users\n`/mute` - Mute users\n`/warn` - Warn users\n`/purge` - Delete messages'
                },
                {
                    name: '💰 Economy Commands (FREE)',
                    value: '`/work` - Earn coins\n`/daily` - Daily reward\n`/beg` - Beg for coins\n`/balance` - Check balance\n`/transfer` - Send coins\n`/leaderboard` - Top earners'
                },
                {
                    name: '📊 Statistics',
                    value: `Servers: ${client.guilds.cache.size}\nUptime: ${Math.floor(client.uptime / 86400000)}d ${Math.floor((client.uptime % 86400000) / 3600000)}h\nVersion: ${client.config.bot.version}`
                },
                {
                    name: '🔗 Links',
                    value: '[Invite Bot](https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands) | [Support Server](https://discord.gg/YOUR_INVITE) | [Website](https://lycebot.com)'
                }
            )
            .setTimestamp()
            .setFooter({ text: client.config.bot.name });

        await interaction.editReply({ embeds: [embed] });
    }
};
