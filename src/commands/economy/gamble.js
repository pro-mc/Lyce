const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Gamble your Lycecoins (Premium only)')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to gamble (min: 10)')
                .setRequired(true)
                .setMinValue(10))
        .addStringOption(option =>
            option.setName('game')
                .setDescription('Choose a game')
                .setRequired(true)
                .addChoices(
                    { name: '🎰 Slots', value: 'slots' },
                    { name: '🎲 Dice Roll', value: 'dice' },
                    { name: '🃏 Blackjack', value: 'blackjack' },
                    { name: '🎯 Roulette', value: 'roulette' }
                )),

    async execute(interaction, client) {
        await interaction.deferReply();

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const amount = interaction.options.getInteger('amount');
        const game = interaction.options.getString('game');

        // Check premium
        const isPremium = await client.premiumManager.hasFeature(
            guildId,
            'premium_economy_activities'
        );

        if (!isPremium) {
            return interaction.editReply({
                embeds: [{
                    color: 0xff9900,
                    title: '🔒 Premium Feature',
                    description: 'Gambling games are available for premium servers only!',
                    fields: [
                        { name: 'Premium Games', value: '• Slots with jackpots\n• Blackjack with side bets\n• Roulette with multiple bets\n• Dice with multipliers' },
                        { name: 'Other Premium Features', value: '• /rob - Steal from players\n• /crime - High-risk crimes\n• /hunt - Creature hunting\n• /fish - Fishing mini-game' },
                        { name: 'Price', value: '$4.99/month', inline: true },
                        { name: 'Get Premium', value: 'Server owner use `/buy`', inline: true }
                    ]
                }]
            });
        }

        // Check user balance
        await client.db.createUser(userId, interaction.user.username, interaction.user.discriminator);
        const user = await client.db.getUser(userId);
        
        if ((user.balance || 0) < amount) {
            return interaction.editReply({
                embeds: [{
                    color: 0xff0000,
                    title: '❌ Insufficient Funds',
                    description: `You need **${amount}** Lycecoins but only have **${user.balance || 0}**.`,
                    fields: [
                        { name: 'Need More Coins?', value: 'Try `/work`, `/daily`, or `/beg`' }
                    ]
                }]
            });
        }

        // Game logic
        let result, winnings = 0, gameName;
        const winChance = 0.4; // 40% chance to win

        switch (game) {
            case 'slots':
                gameName = '🎰 Slots';
                if (Math.random() < winChance) {
                    winnings = amount * 2.5; // 2.5x payout
                    result = 'JACKPOT!';
                } else {
                    winnings = 0;
                    result = 'No match';
                }
                break;

            case 'dice':
                gameName = '🎲 Dice Roll';
                const playerRoll = Math.floor(Math.random() * 6) + 1;
                const houseRoll = Math.floor(Math.random() * 6) + 1;
                
                if (playerRoll > houseRoll) {
                    winnings = amount * 2; // 2x payout
                    result = `You rolled ${playerRoll} vs ${houseRoll}`;
                } else {
                    winnings = 0;
                    result = `You rolled ${playerRoll} vs ${houseRoll}`;
                }
                break;

            case 'blackjack':
                gameName = '🃏 Blackjack';
                if (Math.random() < 0.3) { // 30% chance for blackjack
                    winnings = amount * 3; // 3x payout for blackjack
                    result = 'BLACKJACK!';
                } else if (Math.random() < 0.5) { // 50% chance to win
                    winnings = amount * 2;
                    result = 'You win!';
                } else {
                    winnings = 0;
                    result = 'Bust!';
                }
                break;

            case 'roulette':
                gameName = '🎯 Roulette';
                const number = Math.floor(Math.random() * 37);
                if (number === 0) {
                    winnings = amount * 36; // 36x for 0
                    result = `Landed on 0!`;
                } else if (number % 2 === 0) {
                    winnings = amount * 2; // 2x for even
                    result = `Landed on ${number} (Even)`;
                } else {
                    winnings = 0;
                    result = `Landed on ${number} (Odd)`;
                }
                break;
        }

        // Calculate net gain/loss
        const netChange = winnings - amount;
        const newBalance = (user.balance || 0) + netChange;

        // Update database
        await client.db.updateBalance(userId, netChange);

        // Create result embed
        const embed = {
            color: netChange >= 0 ? 0x00ff00 : 0xff0000,
            title: netChange >= 0 ? '💰 You Won!' : '💸 You Lost',
            description: `**${gameName}**\n${result}`,
            fields: [
                { name: 'Bet Amount', value: `${amount} coins`, inline: true },
                { name: 'Winnings', value: `${winnings} coins`, inline: true },
                { name: 'Net Change', value: `${netChange >= 0 ? '+' : ''}${netChange} coins`, inline: true },
                { name: 'New Balance', value: `${newBalance} coins`, inline: true }
            ],
            timestamp: new Date()
        };

        // Add play again button for winners
        const row = new ActionRowBuilder();
        
        if (netChange > 0) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('gamble_again')
                    .setLabel('🎰 Play Again')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('double_or_nothing')
                    .setLabel('⚡ Double or Nothing')
                    .setStyle(ButtonStyle.Danger)
            );
        } else {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('try_again')
                    .setLabel('🔄 Try Again')
                    .setStyle(ButtonStyle.Primary)
            );
        }

        await interaction.editReply({ 
            embeds: [embed], 
            components: netChange !== 0 ? [row] : [] 
        });

        // Handle button interactions
        const filter = i => i.user.id === userId;
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 15000 
        });

        collector.on('collect', async i => {
            if (i.customId === 'gamble_again') {
                await i.deferUpdate();
                // Could implement auto-play same bet
                embed.fields.push({ 
                    name: 'Auto-play', 
                    value: 'Feature coming soon! Use /gamble again.' 
                });
                await interaction.editReply({ embeds: [embed], components: [] });
            }
            collector.stop();
        });
    }
};
