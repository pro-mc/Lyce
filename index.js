const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config/config');
const db = require('./src/database/db');
const fs = require('fs');
const path = require('path');
const PremiumManager = require('./src/utils/PremiumManager');

class LyceBot extends Client {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildVoiceStates
            ]
        });

        this.config = config;
        this.commands = new Collection();
        this.cooldowns = new Collection();
        this.db = db;
        this.premiumManager = new PremiumManager(this);
    }

    async initialize() {
        console.log('Initializing Lyce Bot...');
        
        await this.db.initialize();
        console.log('Database initialized');
        
        if (this.premiumManager.checkExpirations) {
            await this.premiumManager.checkExpirations();
            console.log('Checked for expired licenses');
        } else {
            console.warn('Warning: premiumManager.checkExpirations is not available');
        }
        
        await this.loadCommands();
        await this.loadEvents();
        
        setInterval(async () => {
            if (this.premiumManager.checkExpirations) {
                const expiredCount = await this.premiumManager.checkExpirations();
                if (expiredCount > 0) {
                    console.log(`Auto-revoked ${expiredCount} expired licenses`);
                }
            }
        }, 60 * 60 * 1000);
        
        this.login(this.config.discord.token).then(() => {
            console.log(`${this.config.bot.name} v${this.config.bot.version} is online!`);
            console.log(`Logged in as ${this.user.tag}`);
            
            this.user.setActivity({
                name: `/help | ${this.guilds.cache.size} servers`,
                type: 3
            });
            
        }).catch(console.error);
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, 'src', 'commands');
        
        if (!fs.existsSync(commandsPath)) {
            console.error('Commands directory does not exist!');
            return;
        }
        
        const commandFolders = fs.readdirSync(commandsPath);

        for (const folder of commandFolders) {
            const folderPath = path.join(commandsPath, folder);
            
            if (!fs.statSync(folderPath).isDirectory()) continue;
            
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                try {
                    const command = require(filePath);
                    
                    if ('data' in command && 'execute' in command) {
                        this.commands.set(command.data.name, command);
                        console.log(`✓ Loaded command: ${command.data.name}`);
                    } else {
                        console.log(`⚠️ Command ${filePath} is missing required properties`);
                    }
                } catch (error) {
                    console.error(`❌ Failed to load command ${file}:`, error.message);
                }
            }
        }
    }

    async loadEvents() {
        const eventsPath = path.join(__dirname, 'src', 'events');
        
        if (!fs.existsSync(eventsPath)) {
            console.error('Events directory does not exist!');
            return;
        }
        
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            try {
                const event = require(filePath);
                
                if (event.once) {
                    this.once(event.name, (...args) => event.execute(...args, this));
                } else {
                    this.on(event.name, (...args) => event.execute(...args, this));
                }
                
                console.log(`✓ Loaded event: ${event.name}`);
            } catch (error) {
                console.error(`❌ Failed to load event ${file}:`, error.message);
            }
        }
    }
}

const bot = new LyceBot();

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    
    try {
        if (bot.db && bot.db.pool) {
            await bot.db.pool.end();
            console.log('Database connection closed');
        }
        
        if (bot.destroy) {
            bot.destroy();
            console.log('Discord client destroyed');
        }
        
        console.log('Goodbye!');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    
    try {
        if (bot.db && bot.db.pool) {
            await bot.db.pool.end();
        }
        
        if (bot.destroy) {
            bot.destroy();
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

bot.initialize().catch(error => {
    console.error('Failed to initialize bot:', error);
    process.exit(1);
});

module.exports = bot;
