const mysql = require("mysql2/promise");
const config = require("../../config/config");

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
            queueLimit: 0,
        });
    }

    async initialize() {
        try {
            await this.createTables();
            await this.fixTables(); // Add this to fix existing tables
            console.log("Database initialized successfully");
        } catch (error) {
            console.error("Database initialization failed:", error);
            throw error;
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

            `CREATE TABLE IF NOT EXISTS premium_licenses (
                id VARCHAR(50) PRIMARY KEY,
                license_key VARCHAR(100) UNIQUE,
                tier ENUM('monthly', 'lifetime', 'yearly') NOT NULL,
                status ENUM('active', 'inactive', 'revoked', 'expired') DEFAULT 'inactive',
                purchaser_discord_id VARCHAR(255),
                activated_guild_id VARCHAR(255),
                activated_at TIMESTAMP NULL,
                expires_at TIMESTAMP NULL,
                admin_note TEXT,
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
                activated_at TIMESTAMP NULL
            )` // REMOVED the trailing comma
        ];

        for (const tableQuery of tables) {
            try {
                await this.pool.execute(tableQuery);
            } catch (error) {
                console.error(`Error creating table: ${error.message}`);
            }
        }

        // Add missing columns if needed
        await this.addMissingColumns();
    }

    async addMissingColumns() {
        try {
            // Check and add admin_note if missing
            const [columns] = await this.pool.execute(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME = 'premium_licenses' 
                AND COLUMN_NAME = 'admin_note'
            `, [config.database.name]);
            
            if (columns.length === 0) {
                await this.pool.execute(`
                    ALTER TABLE premium_licenses 
                    ADD COLUMN admin_note TEXT
                `);
                console.log('✓ Added admin_note column to premium_licenses table');
            }
        } catch (error) {
            console.log('Note: admin_note column may already exist or error:', error.message);
        }
    }

    async fixTables() {
        try {
            // Remove foreign key constraint if it exists
            console.log('Checking for foreign key constraints...');
            
            const [constraints] = await this.pool.execute(`
                SELECT CONSTRAINT_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME = 'premium_features'
                AND CONSTRAINT_TYPE = 'FOREIGN KEY'
            `, [config.database.name]);
            
            for (const constraint of constraints) {
                try {
                    await this.pool.execute(`
                        ALTER TABLE premium_features 
                        DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}
                    `);
                    console.log(`✓ Removed foreign key constraint: ${constraint.CONSTRAINT_NAME}`);
                } catch (error) {
                    console.log(`Note: Could not remove constraint ${constraint.CONSTRAINT_NAME}:`, error.message);
                }
            }
            
            // Ensure server_settings entry exists for all guilds that have premium
            const [premiumGuilds] = await this.pool.execute(`
                SELECT DISTINCT guild_id 
                FROM premium_features 
                WHERE guild_id NOT IN (SELECT guild_id FROM server_settings)
            `);
            
            for (const row of premiumGuilds) {
                try {
                    await this.pool.execute(
                        'INSERT INTO server_settings (guild_id, prefix) VALUES (?, ?)',
                        [row.guild_id, '/']
                    );
                    console.log(`✓ Added server settings for guild ${row.guild_id}`);
                } catch (error) {
                    console.log(`Note: Could not add server settings for guild ${row.guild_id}:`, error.message);
                }
            }
            
        } catch (error) {
            console.log('Error fixing tables:', error.message);
        }
    }

    async query(sql, params) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error("Database query error:", error);
            throw error;
        }
    }

    async getUser(userId) {
        const [rows] = await this.pool.execute(
            "SELECT * FROM users WHERE id = ?",
            [userId],
        );
        return rows[0];
    }

    async createUser(userId, username, discriminator) {
        await this.pool.execute(
            "INSERT INTO users (id, username, discriminator) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username = ?, discriminator = ?",
            [userId, username, discriminator, username, discriminator],
        );
    }

    async updateBalance(userId, amount) {
        await this.pool.execute(
            "UPDATE users SET balance = balance + ? WHERE id = ?",
            [amount, userId],
        );
    }
}

module.exports = new Database();
