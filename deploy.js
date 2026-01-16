const { REST, Routes, ApplicationCommandPermissionType } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandPermissions = [];

const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFolders = fs.readdirSync(commandsPath);

// Owner IDs (replace with your Discord ID)
const OWNER_IDS = [process.env.OWNER_ID];

// Load all commands
for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        
        if ('data' in command) {
            commands.push(command.data.toJSON());
            
            // Set permissions for admin commands
            if (folder === 'admin') {
                commandPermissions.push({
                    commandName: command.data.name,
                    permissions: OWNER_IDS.map(ownerId => ({
                        id: ownerId,
                        type: ApplicationCommandPermissionType.User,
                        permission: true
                    }))
                });
            }
            
            console.log(`✓ Loaded command: ${command.data.name}`);
        }
    }
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

        // Apply permissions for admin commands in each guild
        const guilds = await rest.get(Routes.userGuilds());
        
        for (const guild of guilds) {
            try {
                const commands = await rest.get(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id)
                );
                
                for (const perm of commandPermissions) {
                    const command = commands.find(c => c.name === perm.commandName);
                    if (command) {
                        await rest.put(
                            Routes.applicationCommandPermissions(
                                process.env.CLIENT_ID,
                                guild.id,
                                command.id
                            ),
                            { body: { permissions: perm.permissions } }
                        );
                        console.log(`Set permissions for ${command.name} in ${guild.name}`);
                    }
                }
            } catch (error) {
                console.error(`Failed to set permissions in guild ${guild.name}:`, error.message);
            }
        }

        console.log('All commands deployed successfully!');
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();
