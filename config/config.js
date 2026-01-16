require('dotenv').config();

module.exports = {
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.CLIENT_ID,
        guildId: process.env.GUILD_ID
    },
    database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    },
    bot: {
        prefix: process.env.PREFIX,
        color: process.env.BOT_COLOR,
        name: "Lyce",
        version: "2.0.0"
    },
    features: {
        maxFreeKeywords: 3,
        maxFreePurge: 100,
        premiumPurgeLimit: 50000,
        dailyReward: 100,
        workCooldown: 3600000,
        dailyCooldown: 86400000,
        begCooldown: 30000
    }
};
