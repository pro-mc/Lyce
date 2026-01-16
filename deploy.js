const { REST, Routes, ApplicationCommandPermissionType } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandPermissions = [];

const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFolders = fs.readdirSync(commandsPath);

// Owner ID
const OWNER_ID = process.env.OWNER_ID || '1240540042926096406';

console.log('Loading commands...');

// Load all commands
for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        try {
            const filePath = path.join(folderPath, file);
            delete require.cache[require.resolve(filePath)]; // Clear cache
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                
                // Set permissions for admin commands
                if (folder === 'admin') {
                    commandPermissions.push({
                        commandName: command.data.name,
                        permissions: [{
                            id: OWNER_ID,
                            type: ApplicationCommandPermissionType.User,
                            permission: true
                        }]
                    });
                }
                
                console.log(`✓ Loaded command: ${command.data.name}`);
            } else {
                console.log(`⚠️ Skipping ${file}: Missing "data" or "execute" property`);
            }
        } catch (error) {
            console.error(`✗ Failed to load command ${file} in ${folder}:`, error.message);
            if (error.message.includes('createlicense')) {
                console.error('Check syntax in createlicense.js - there might be a typo');
            }
        }
    }
}

if (commands.length === 0) {
    console.error('No commands loaded! Check your command files for errors.');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Register commands globally
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`Successfully registered ${data.length} commands globally.`);

        // If you want to set permissions in specific guilds
        if (process.env.GUILD_ID) {
            const guildId = process.env.GUILD_ID;
            const commands = await rest.get(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId)
            );
            
            for (const perm of commandPermissions) {
                const command = commands.find(c => c.name === perm.commandName);
                if (command) {
                    await rest.put(
                        Routes.applicationCommandPermissions(
                            process.env.CLIENT_ID,
                            guildId,
                            command.id
                        ),
                        { body: { permissions: perm.permissions } }
                    );
                    console.log(`Set permissions for ${command.name} in guild ${guildId}`);
                }
            }
        }

        console.log('✅ All commands deployed successfully!');
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        if (error.code === 50001) {
            console.error('Missing Access - Check bot permissions in the server');
        }
    }
})();
