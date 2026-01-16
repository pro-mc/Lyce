const crypto = require('crypto');
const config = require('../../config/config');

class PremiumManager {
    constructor(client) {
        this.client = client;
        this.features = {
            monthly: {
                name: 'Monthly',
                price: 4.99,
                duration: 30, // days
                features: [
                    'unlimited_keyword_filtering',
                    'advanced_raid_protection',
                    'premium_economy_activities',
                    'extended_logs',
                    'web_dashboard',
                    'custom_commands'
                ]
            },
            lifetime: {
                name: 'Lifetime',
                price: 60.00,
                duration: 36500, // ~100 years
                features: [
                    'unlimited_keyword_filtering',
                    'advanced_raid_protection',
                    'premium_economy_activities',
                    'extended_logs',
                    'web_dashboard',
                    'custom_commands',
                    'priority_support',
                    'api_access'
                ]
            },
            yearly: {
                name: 'Yearly',
                price: 49.99,
                duration: 365,
                features: [
                    'unlimited_keyword_filtering',
                    'advanced_raid_protection',
                    'premium_economy_activities',
                    'extended_logs',
                    'web_dashboard',
                    'custom_commands',
                    'api_access'
                ]
            }
        };
    }

    generateLicenseKey(tier) {
        const prefix = tier.toUpperCase().substring(0, 3);
        const random = crypto.randomBytes(8).toString('hex').toUpperCase();
        const timestamp = Date.now().toString(36).toUpperCase();
        return `${prefix}-${random}-${timestamp}`;
    }

    async createLicense(tier, purchaserDiscordId = null) {
        const licenseKey = this.generateLicenseKey(tier);
        const licenseId = crypto.randomBytes(10).toString('hex');
        const tierData = this.features[tier];
        
        let expiresAt = null;
        if (tier !== 'lifetime') {
            expiresAt = new Date(Date.now() + tierData.duration * 24 * 60 * 60 * 1000);
        }

        await this.client.db.query(
            `INSERT INTO premium_licenses 
             (id, license_key, tier, status, purchaser_discord_id, expires_at) 
             VALUES (?, ?, ?, 'inactive', ?, ?)`,
            [licenseId, licenseKey, tier, purchaserDiscordId, expiresAt]
        );

        return {
            licenseId,
            licenseKey,
            tier: tierData.name,
            price: tierData.price,
            features: tierData.features,
            expiresAt
        };
    }

    async activateLicense(guildId, licenseKey, activatorId) {
        // Check if guild already has premium
        const existing = await this.client.db.query(
            'SELECT * FROM premium_features WHERE guild_id = ?',
            [guildId]
        );

        if (existing.length > 0 && existing[0].is_premium) {
            return { success: false, message: 'This server already has an active premium subscription.' };
        }

        // Get license
        const [license] = await this.client.db.query(
            `SELECT * FROM premium_licenses WHERE license_key = ? AND status = 'inactive'`,
            [licenseKey]
        );

        if (!license) {
            return { success: false, message: 'Invalid or already used license key.' };
        }

        // Check expiration for non-lifetime
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            await this.client.db.query(
                `UPDATE premium_licenses SET status = 'expired' WHERE id = ?`,
                [license.id]
            );
            return { success: false, message: 'This license has expired.' };
        }

        // Activate license
        const tierData = this.features[license.tier];
        const expiresAt = license.expires_at || 
            (license.tier === 'lifetime' ? null : 
             new Date(Date.now() + tierData.duration * 24 * 60 * 60 * 1000));

        await this.client.db.query(
            `UPDATE premium_licenses 
             SET status = 'active', activated_guild_id = ?, activated_at = NOW() 
             WHERE id = ?`,
            [guildId, license.id]
        );

        // Create premium features entry
        await this.client.db.query(
            `INSERT INTO premium_features 
             (guild_id, is_premium, premium_tier, features, expires_at, activated_at) 
             VALUES (?, true, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE 
             is_premium = true, premium_tier = ?, features = ?, expires_at = ?`,
            [guildId, license.tier, JSON.stringify(tierData.features), expiresAt,
             license.tier, JSON.stringify(tierData.features), expiresAt]
        );

        // Log activation
        await this.client.db.query(
            `INSERT INTO payments 
             (id, user_id, license_id, amount, currency, provider, status) 
             VALUES (?, ?, ?, ?, 'USD', 'manual', 'completed')`,
            [crypto.randomBytes(10).toString('hex'), activatorId, license.id, tierData.price]
        );

        return {
            success: true,
            message: `✅ Premium ${tierData.name} activated successfully!`,
            tier: tierData.name,
            expiresAt,
            features: tierData.features
        };
    }

    async revokeLicense(guildId) {
        await this.client.db.query(
            `UPDATE premium_licenses SET status = 'revoked' WHERE activated_guild_id = ?`,
            [guildId]
        );

        await this.client.db.query(
            `UPDATE premium_features SET is_premium = false WHERE guild_id = ?`,
            [guildId]
        );

        return { success: true, message: 'Premium license revoked.' };
    }

    async checkPremiumStatus(guildId) {
        const [premium] = await this.client.db.query(
            `SELECT * FROM premium_features WHERE guild_id = ?`,
            [guildId]
        );

        if (!premium || !premium.is_premium) {
            return { isPremium: false };
        }

        // Check expiration
        if (premium.expires_at && new Date(premium.expires_at) < new Date()) {
            await this.revokeLicense(guildId);
            return { isPremium: false, expired: true };
        }

        return {
            isPremium: true,
            tier: premium.premium_tier,
            expiresAt: premium.expires_at,
            features: JSON.parse(premium.features || '[]'),
            activatedAt: premium.activated_at
        };
    }

    async hasFeature(guildId, feature) {
        const status = await this.checkPremiumStatus(guildId);
        
        if (!status.isPremium) {
            return false;
        }

        return status.features.includes(feature);
    }

    async getLicenseInfo(licenseKey) {
        const [license] = await this.client.db.query(
            `SELECT * FROM premium_licenses WHERE license_key = ?`,
            [licenseKey]
        );

        if (!license) return null;

        const [activation] = await this.client.db.query(
            `SELECT * FROM premium_features WHERE guild_id = ?`,
            [license.activated_guild_id]
        );

        return {
            license,
            activation: activation || null,
            tierInfo: this.features[license.tier] || null
        };
    }

    async checkExpiredLicenses() {
        const expired = await this.client.db.query(
            `SELECT * FROM premium_licenses 
             WHERE status = 'active' 
             AND expires_at IS NOT NULL 
             AND expires_at < NOW()`
        );

        for (const license of expired) {
            await this.revokeLicense(license.activated_guild_id);
            await this.client.db.query(
                `UPDATE premium_licenses SET status = 'expired' WHERE id = ?`,
                [license.id]
            );
            
            // Notify server owner if possible
            try {
                const guild = this.client.guilds.cache.get(license.activated_guild_id);
                if (guild) {
                    const owner = await guild.fetchOwner();
                    await owner.send({
                        embeds: [{
                            color: 0xff9900,
                            title: 'Premium Subscription Expired',
                            description: `Your ${this.features[license.tier]?.name || license.tier} premium subscription for **${guild.name}** has expired.`,
                            fields: [
                                { name: 'License Key', value: license.license_key },
                                { name: 'Renew', value: 'Visit our website to renew your subscription' },
                                { name: 'Features Disabled', value: 'Premium features have been disabled for your server.' }
                            ],
                            timestamp: new Date()
                        }]
                    });
                }
            } catch (error) {
                console.error('Failed to notify guild owner:', error);
            }
        }

        return expired.length;
    }

    async createCheckoutSession(userId, tier, returnUrl) {
        // This would integrate with Stripe or PayPal
        // For now, we'll return a mock session
        const tierData = this.features[tier];
        const sessionId = `cs_${crypto.randomBytes(16).toString('hex')}`;
        
        return {
            id: sessionId,
            url: `https://website.com/checkout/${sessionId}`,
            price: tierData.price,
            currency: 'USD',
            tier: tierData.name
        };
    }
}

module.exports = PremiumManager;
