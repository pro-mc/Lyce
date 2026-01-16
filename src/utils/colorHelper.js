class ColorHelper {
    static getColor(client) {
        const configColor = client.config?.bot?.color;
        
        if (typeof configColor === 'number') {
            return configColor;
        }
        
        if (typeof configColor === 'string') {
            const cleanColor = configColor.replace('#', '');
            
            if (/^[0-9A-Fa-f]{6}$/.test(cleanColor)) {
                return parseInt(cleanColor, 16);
            }
            
            const decimal = parseInt(configColor);
            if (!isNaN(decimal)) {
                return decimal;
            }
        }
        
        return 3447003;
    }
    
    static hexToDecimal(hex) {
        const cleanHex = hex.replace('#', '');
        return parseInt(cleanHex, 16);
    }
}

module.exports = ColorHelper;
