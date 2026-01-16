module.exports = {
    name: 'clientReady', // Changed from 'ready' to 'clientReady'
    once: true,
    async execute(client) {
        console.log(`✅ ${client.user.tag} is online!`);
        console.log(`📊 Serving ${client.guilds.cache.size} servers`);
        
        // Set bot activity
        client.user.setActivity({
            name: `/help | ${client.guilds.cache.size} servers`,
            type: 3 // WATCHING
        });
        
        // Update activity every 10 minutes
        setInterval(() => {
            client.user.setActivity({
                name: `/help | ${client.guilds.cache.size} servers`,
                type: 3
            });
        }, 10 * 60 * 1000);
    }
};
