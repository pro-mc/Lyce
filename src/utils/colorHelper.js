class ColorHelper {
    static getColor(client) {
        const configColor = client.config?.bot?.color;
        
        // If color is already a number, return it
        if (typeof configColor === 'number') {
            return configColor;
        }
        
        // If it's a string, try to parse it
        if (typeof configColor === 'string') {
            // Remove # if present
            const cleanColor = configColor.replace('#', '');
            
            // Try to parse as hex
            if (/^[0-9A-Fa-f]{6}$/.test(cleanColor)) {
                return parseInt(cleanColor, 16);
            }
            
            // Try to parse as decimal
            const decimal = parseInt(configColor);
            if (!isNaN(decimal)) {
                return decimal;
            }
        }
        
        // Default fallback color (#2196F3 in decimal)
        return 3447003;
    }
    
    static hexToDecimal(hex) {
        // Remove # if present
        const cleanHex = hex.replace('#', '');
        return parseInt(cleanHex, 16);
    }
}

module.exports = ColorHelper;
