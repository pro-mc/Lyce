module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Logged in as ${client.user.tag}`);
        
        client.user.setActivity({
            name: `/help | Protecting ${client.guilds.cache.size} servers`,
            type: 3
        });
        
        setInterval(() => {
            client.user.setActivity({
                name: `/help | Protecting ${client.guilds.cache.size} servers`,
                type: 3
            });
        }, 300000);
    }
};
