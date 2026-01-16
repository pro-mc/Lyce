const mysql = require('mysql2/promise');
const config = require('../../config/config');

class Database {
    constructor() {
        this.pool = mysql.createPool({
            host: config.database.host,
            port: config.database.port,
            user: config.database.user,
            password: config.database.password,
            database: config.database.name,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    async initialize() {
        try {
            await this.createTables();
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization failed:', error);
        }
    }

    async createTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255),
                discriminator VARCHAR(10),
                balance BIGINT DEFAULT 0,
                daily_streak INT DEFAULT 0,
                last_daily TIMESTAMP NULL,
                last_work TIMESTAMP NULL,
                last_beg TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS infractions (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255),
                moderator_id VARCHAR(255),
                type ENUM('warn', 'mute', 'kick', 'ban', 'note'),
                reason TEXT,
                duration INT,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS economy_items (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255),
                item_name VARCHAR(255),
                quantity INT DEFAULT 1,
                obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS server_settings (
                guild_id VARCHAR(255) PRIMARY KEY,
                prefix VARCHAR(10) DEFAULT '/',
                mod_log_channel VARCHAR(255),
                welcome_channel VARCHAR(255),
                muted_role VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS keyword_filters (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(255),
                keyword VARCHAR(255),
                action ENUM('delete', 'warn', 'mute', 'kick'),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS premium_servers (
                guild_id VARCHAR(255) PRIMARY KEY,
                premium_tier ENUM('monthly', 'lifetime'),
                purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NULL
            )`
        ];

        `CREATE TABLE IF NOT EXISTS premium_licenses (
            id VARCHAR(50) PRIMARY KEY,
            license_key VARCHAR(100) UNIQUE,
            tier ENUM('monthly', 'lifetime', 'yearly') NOT NULL,
            status ENUM('active', 'inactive', 'revoked', 'expired') DEFAULT 'inactive',
            purchaser_discord_id VARCHAR(255),
            activated_guild_id VARCHAR(255),
            activated_at TIMESTAMP NULL,
            expires_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS payments (
            id VARCHAR(50) PRIMARY KEY,
            user_id VARCHAR(255),
            license_id VARCHAR(50),
            amount DECIMAL(10, 2),
            currency VARCHAR(10),
            provider VARCHAR(50),
            provider_payment_id VARCHAR(255),
            status ENUM('pending', 'completed', 'failed', 'refunded'),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (license_id) REFERENCES premium_licenses(id) ON DELETE SET NULL
        )`,

        `CREATE TABLE IF NOT EXISTS premium_features (
            guild_id VARCHAR(255) PRIMARY KEY,
            is_premium BOOLEAN DEFAULT false,
            premium_tier VARCHAR(50),
            features JSON,
            expires_at TIMESTAMP NULL,
            activated_at TIMESTAMP NULL,
            FOREIGN KEY (guild_id) REFERENCES server_settings(guild_id) ON DELETE CASCADE
        )`
    ];

        for (const tableQuery of tables) {
            await this.pool.execute(tableQuery);
        }
    }

    async query(sql, params) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    async getUser(userId) {
        const [rows] = await this.pool.execute(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        return rows[0];
    }

    async createUser(userId, username, discriminator) {
        await this.pool.execute(
            'INSERT INTO users (id, username, discriminator) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username = ?, discriminator = ?',
            [userId, username, discriminator, username, discriminator]
        );
    }

    async updateBalance(userId, amount) {
        await this.pool.execute(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            [amount, userId]
        );
    }

    async addInfraction(infractionId, userId, moderatorId, type, reason, duration = null) {
        await this.pool.execute(
            'INSERT INTO infractions (id, user_id, moderator_id, type, reason, duration, expires_at) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))',
            [infractionId, userId, moderatorId, type, reason, duration, duration]
        );
    }

    async getInfractions(userId) {
        return await this.query(
            'SELECT * FROM infractions WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
    }
}

module.exports = new Database();
