require('dotenv').config();

module.exports = {
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.CLIENT_ID,
        guildId: process.env.GUILD_ID
    },
    database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        name: process.env.DB_NAME
    },
    bot: {
        prefix: process.env.PREFIX || '/',
        color: parseInt(process.env.BOT_COLOR) || 3447003, // Convert to number
        name: process.env.BOT_NAME || "Lyce",
        version: process.env.BOT_VERSION || "2.0.0"
    },
    features: {
        maxFreeKeywords: 3,
        maxFreePurge: 100,
        premiumPurgeLimit: 50000,
        dailyReward: 100,
        workCooldown: 3600000,
        dailyCooldown: 86400000,
        begCooldown: 30000
    },
    // Add owner ID to config
    ownerId: process.env.OWNER_ID || '1240540042926096406'
};
