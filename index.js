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
        await this.db.initialize();
        await this.premiumManager.checkExpiredLicenses();
        await this.loadCommands();
        await this.loadEvents();

        setInterval(async () => {
            await this.premiumManager.checkExpiredLicenses();
        }, 24 * 60 * 60 * 1000);
        
        this.login(this.config.discord.token).then(() => {
            console.log(`${this.config.bot.name} v${this.config.bot.version} is online!`);
        }).catch(console.error);
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, 'src', 'commands');
        const commandFolders = fs.readdirSync(commandsPath);

        for (const folder of commandFolders) {
            const folderPath = path.join(commandsPath, folder);
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    this.commands.set(command.data.name, command);
                    console.log(`Loaded command: ${command.data.name}`);
                } else {
                    console.log(`Command ${filePath} is missing required properties`);
                }
            }
        }
    }

    async loadEvents() {
        const eventsPath = path.join(__dirname, 'src', 'events');
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);
            
            if (event.once) {
                this.once(event.name, (...args) => event.execute(...args, this));
            } else {
                this.on(event.name, (...args) => event.execute(...args, this));
            }
            
            console.log(`Loaded event: ${event.name}`);
        }
    }
}

const bot = new LyceBot();
bot.initialize();

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await bot.db.pool.end();
    process.exit(0);
});
