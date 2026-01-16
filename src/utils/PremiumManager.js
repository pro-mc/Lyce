const crypto = require('crypto');
const config = require('../../config/config');
const { REST } = require('discord.js');
const { v4: uuidv4 } = require('uuid');

class PremiumManager {
    constructor(client) {
        this.client = client;
        this.rest = new REST({ version: '10' }).setToken(config.discord.token);
        
        this.features = {
            monthly: {
                name: 'Monthly Premium',
                skuId: process.env.SKU_MONTHLY || 'monthly_sku_id',
                price: 4.99,
                duration: 30,
                features: [
                    'unlimited_keyword_filtering',
                    'advanced_raid_protection', 
                    'premium_economy_activities',
                    'extended_logs_90_days',
                    'web_dashboard_access',
                    'custom_commands_20',
                    'global_leaderboard',
                    'bulk_purge_50000'
                ]
            },
            yearly: {
                name: 'Yearly Premium',
                skuId: process.env.SKU_YEARLY || 'yearly_sku_id',
                price: 49.99,
                duration: 365,
                features: [
                    'unlimited_keyword_filtering',
                    'advanced_raid_protection',
                    'premium_economy_activities',
                    'extended_logs_90_days',
                    'web_dashboard_access',
                    'custom_commands_50',
                    'global_leaderboard',
                    'bulk_purge_50000',
                    'api_access',
                    'priority_support'
                ]
            },
            lifetime: {
                name: 'Lifetime Premium',
                skuId: process.env.SKU_LIFETIME || 'lifetime_sku_id',
                price: 60.00,
                duration: 36500,
                features: [
                    'unlimited_keyword_filtering',
                    'advanced_raid_protection',
                    'premium_economy_activities',
                    'extended_logs_90_days',
                    'web_dashboard_access',
                    'custom_commands_unlimited',
                    'global_leaderboard',
                    'bulk_purge_50000',
                    'api_access',
                    'priority_support',
                    'early_access_features',
                    'custom_branding'
                ]
            }
        };
    }

    generateLicenseKey(tier) {
        const prefix = tier.slice(0, 3).toUpperCase();
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        return `LYCE-${prefix}-${timestamp}-${random}`;
    }

    async createLicense(tier, purchaserId = null, adminNote = '') {
        const licenseKey = this.generateLicenseKey(tier);
        const licenseId = `LIC_${uuidv4().split('-')[0].toUpperCase()}`;
        const tierData = this.features[tier];
        
        let expiresAt = null;
        if (tier !== 'lifetime') {
            expiresAt = new Date(Date.now() + tierData.duration * 24 * 60 * 60 * 1000);
        }

        await this.client.db.query(
            `INSERT INTO premium_licenses 
             (id, license_key, tier, status, purchaser_discord_id, expires_at, admin_note) 
             VALUES (?, ?, ?, 'inactive', ?, ?, ?)`,
            [licenseId, licenseKey, tier, purchaserId, expiresAt, adminNote]
        );

        console.log(`📄 License created: ${licenseKey} (${tier})`);

        return {
            licenseId,
            licenseKey,
            tier: tierData.name,
            price: tierData.price,
            features: tierData.features,
            expiresAt: expiresAt ? expiresAt.toISOString() : null
        };
    }

    async activateLicense(guildId, licenseKey, activatorId) {
        // Verify guild owner
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) {
            return { success: false, message: 'Guild not found.' };
        }

        const ownerId = guild.ownerId;
        if (activatorId !== ownerId) {
            return { 
                success: false, 
                message: 'Only the server owner can activate premium for this server.' 
            };
        }

        // Check if guild already has active premium
        const [existing] = await this.client.db.query(
            `SELECT * FROM premium_features 
             WHERE guild_id = ? AND is_premium = 1 
             AND (expires_at IS NULL OR expires_at > NOW())`,
            [guildId]
        );

        if (existing) {
            const expires = existing.expires_at ? 
                `Expires: ${new Date(existing.expires_at).toLocaleDateString()}` : 
                'Lifetime License';
            return { 
                success: false, 
                message: `This server already has active premium (${existing.premium_tier}). ${expires}` 
            };
        }

        // Get and validate license
        const [license] = await this.client.db.query(
            `SELECT * FROM premium_licenses 
             WHERE license_key = ? AND status = 'inactive'`,
            [licenseKey]
        );

        if (!license) {
            return { 
                success: false, 
                message: 'Invalid license key. It may be already used or expired.' 
            };
        }

        // Check expiration for non-lifetime
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            await this.client.db.query(
                `UPDATE premium_licenses SET status = 'expired' WHERE id = ?`,
                [license.id]
            );
            return { success: false, message: 'This license has expired.' };
        }

        // Calculate expiration
        const tierData = this.features[license.tier];
        let expiresAt = license.expires_at;
        if (!expiresAt && license.tier !== 'lifetime') {
            expiresAt = new Date(Date.now() + tierData.duration * 24 * 60 * 60 * 1000);
        }

        // Begin transaction
        const connection = await this.client.db.pool.getConnection();
        await connection.beginTransaction();

        try {
            // Update license
            await connection.query(
                `UPDATE premium_licenses 
                 SET status = 'active', activated_guild_id = ?, activated_at = NOW() 
                 WHERE id = ?`,
                [guildId, license.id]
            );

            // Create/update premium features
            await connection.query(
                `INSERT INTO premium_features 
                 (guild_id, is_premium, premium_tier, features, expires_at, activated_at) 
                 VALUES (?, 1, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE 
                 is_premium = 1, premium_tier = ?, features = ?, expires_at = ?`,
                [
                    guildId,
                    license.tier,
                    JSON.stringify(tierData.features),
                    expiresAt,
                    license.tier,
                    JSON.stringify(tierData.features),
                    expiresAt
                ]
            );

            // Record payment if purchaser exists
            if (license.purchaser_discord_id) {
                await connection.query(
                    `INSERT INTO payments 
                     (id, user_id, license_id, amount, currency, provider, status) 
                     VALUES (?, ?, ?, ?, 'USD', 'manual', 'completed')`,
                    [
                        `PAY_${uuidv4().split('-')[0].toUpperCase()}`,
                        license.purchaser_discord_id,
                        license.id,
                        tierData.price
                    ]
                );
            }

            await connection.commit();
            console.log(`✅ License ${licenseKey} activated for guild ${guildId}`);

            // Update guild settings if needed
            await this.client.db.query(
                `INSERT INTO server_settings (guild_id) VALUES (?) 
                 ON DUPLICATE KEY UPDATE guild_id = guild_id`,
                [guildId]
            );

            return {
                success: true,
                message: `✅ **${tierData.name}** activated successfully for **${guild.name}**!`,
                tier: tierData.name,
                expiresAt: expiresAt ? expiresAt.toISOString() : null,
                features: tierData.features
            };

        } catch (error) {
            await connection.rollback();
            console.error('License activation failed:', error);
            return { 
                success: false, 
                message: 'Failed to activate license. Please try again or contact support.' 
            };
        } finally {
            connection.release();
        }
    }

    async checkGuildPremium(guildId) {
        const [premium] = await this.client.db.query(
            `SELECT pf.*, pl.license_key, pl.activated_at as license_activated
             FROM premium_features pf
             LEFT JOIN premium_licenses pl ON pl.activated_guild_id = pf.guild_id AND pl.status = 'active'
             WHERE pf.guild_id = ? AND pf.is_premium = 1`,
            [guildId]
        );

        if (!premium) {
            return { 
                isPremium: false,
                features: [],
                tier: 'free'
            };
        }

        // Check expiration
        if (premium.expires_at && new Date(premium.expires_at) < new Date()) {
            await this.revokePremium(guildId, 'expired');
            return { isPremium: false, expired: true };
        }

        return {
            isPremium: true,
            tier: premium.premium_tier,
            tierName: this.features[premium.premium_tier]?.name || premium.premium_tier,
            expiresAt: premium.expires_at,
            features: JSON.parse(premium.features || '[]'),
            activatedAt: premium.activated_at,
            licenseKey: premium.license_key
        };
    }

    async hasFeature(guildId, featureName) {
        const premium = await this.checkGuildPremium(guildId);
        if (!premium.isPremium) return false;
        
        return premium.features.includes(featureName);
    }

    async revokePremium(guildId, reason = 'manual') {
        const connection = await this.client.db.pool.getConnection();
        await connection.beginTransaction();

        try {
            // Deactivate license
            await connection.query(
                `UPDATE premium_licenses 
                 SET status = ? 
                 WHERE activated_guild_id = ? AND status = 'active'`,
                [reason === 'expired' ? 'expired' : 'revoked', guildId]
            );

            // Remove premium features
            await connection.query(
                `UPDATE premium_features 
                 SET is_premium = 0, expires_at = NOW() 
                 WHERE guild_id = ?`,
                [guildId]
            );

            await connection.commit();
            console.log(`📛 Premium revoked for guild ${guildId} (${reason})`);

            // Notify guild owner
            try {
                const guild = this.client.guilds.cache.get(guildId);
                if (guild) {
                    const owner = await guild.fetchOwner();
                    await owner.send({
                        embeds: [{
                            color: 0xff9900,
                            title: 'Premium Subscription Ended',
                            description: `Your premium subscription for **${guild.name}** has been ${reason === 'expired' ? 'expired' : 'revoked'}.`,
                            fields: [
                                { name: 'Reason', value: reason === 'expired' ? 'Subscription expired' : 'License revoked' },
                                { name: 'Effect', value: 'Premium features have been disabled.' },
                                { name: 'Renew', value: 'Use `/buy` to purchase a new license' }
                            ],
                            timestamp: new Date()
                        }]
                    });
                }
            } catch (error) {
                console.error('Failed to notify guild owner:', error);
            }

            return { success: true, message: `Premium revoked for guild ${guildId}` };

        } catch (error) {
            await connection.rollback();
            console.error('Failed to revoke premium:', error);
            return { success: false, message: 'Failed to revoke premium.' };
        } finally {
            connection.release();
        }
    }

    async checkExpirations() {
        console.log('🔍 Checking for expired premium subscriptions...');
        
        const expired = await this.client.db.query(
            `SELECT pf.guild_id, pl.license_key, pf.premium_tier 
             FROM premium_features pf
             JOIN premium_licenses pl ON pl.activated_guild_id = pf.guild_id
             WHERE pf.is_premium = 1 
             AND pf.expires_at IS NOT NULL 
             AND pf.expires_at < NOW()`
        );

        let revokedCount = 0;
        for (const sub of expired) {
            await this.revokePremium(sub.guild_id, 'expired');
            revokedCount++;
        }

        console.log(`📛 Revoked ${revokedCount} expired subscriptions`);
        return revokedCount;
    }

    // Discord SKU Integration
    async syncDiscordSKUs() {
        try {
            // Get SKUs from Discord API
            const skus = await this.rest.get(
                `/applications/${this.client.user.id}/skus`
            );

            console.log('Discord SKUs:', skus);

            // Update our SKU IDs in database
            for (const sku of skus) {
                const skuType = sku.name.toLowerCase();
                if (skuType.includes('monthly')) {
                    process.env.SKU_MONTHLY = sku.id;
                    this.features.monthly.skuId = sku.id;
                } else if (skuType.includes('yearly')) {
                    process.env.SKU_YEARLY = sku.id;
                    this.features.yearly.skuId = sku.id;
                } else if (skuType.includes('lifetime')) {
                    process.env.SKU_LIFETIME = sku.id;
                    this.features.lifetime.skuId = sku.id;
                }
            }

            return true;
        } catch (error) {
            console.error('Failed to sync Discord SKUs:', error);
            return false;
        }
    }

    async handleDiscordEntitlement(entitlement) {
        const { sku_id, guild_id, user_id } = entitlement;
        
        // Map SKU to tier
        let tier;
        if (sku_id === this.features.monthly.skuId) tier = 'monthly';
        else if (sku_id === this.features.yearly.skuId) tier = 'yearly';
        else if (sku_id === this.features.lifetime.skuId) tier = 'lifetime';
        else {
            console.error('Unknown SKU:', sku_id);
            return false;
        }

        // Create and activate license
        const license = await this.createLicense(tier, user_id, 'Discord Purchase');
        const result = await this.activateLicense(guild_id, license.licenseKey, user_id);

        if (result.success) {
            // Record Discord payment
            await this.client.db.query(
                `INSERT INTO payments 
                 (id, user_id, license_id, amount, currency, provider, provider_payment_id, status) 
                 VALUES (?, ?, ?, ?, 'USD', 'discord', ?, 'completed')`,
                [
                    `PAY_${uuidv4().split('-')[0].toUpperCase()}`,
                    user_id,
                    license.licenseId,
                    this.features[tier].price,
                    entitlement.id
                ]
            );

            // Send confirmation
            try {
                const user = await this.client.users.fetch(user_id);
                await user.send({
                    embeds: [{
                        color: 0x00ff00,
                        title: '🎉 Premium Activated via Discord',
                        description: `Your **${this.features[tier].name}** has been activated!`,
                        fields: [
                            { name: 'Server', value: `<#${guild_id}> (ID: ${guild_id})`, inline: true },
                            { name: 'Amount', value: `$${this.features[tier].price}`, inline: true },
                            { name: 'License Key', value: `\`${license.licenseKey}\`` }
                        ],
                        footer: { text: 'Thank you for your purchase!' }
                    }]
                });
            } catch (error) {
                console.error('Failed to send confirmation:', error);
            }
        }

        return result.success;
    }

    async createDiscordPurchaseLink(guildId, tier) {
        const skuId = this.features[tier]?.skuId;
        if (!skuId) return null;

        return `https://discord.com/application-directory/${this.client.user.id}/sku/${skuId}?guild_id=${guildId}`;
    }

    async getGuildOwner(guildId) {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return null;
        
        try {
            return await guild.fetchOwner();
        } catch (error) {
            console.error('Failed to fetch guild owner:', error);
            return null;
        }
    }

    async validateGuildOwnership(guildId, userId) {
        const owner = await this.getGuildOwner(guildId);
        return owner && owner.id === userId;
    }

    async getLicenseInfo(licenseKey) {
        const [license] = await this.client.db.query(
            `SELECT pl.*, pf.guild_id, pf.activated_at as premium_activated, pf.expires_at as premium_expires
             FROM premium_licenses pl
             LEFT JOIN premium_features pf ON pf.guild_id = pl.activated_guild_id
             WHERE pl.license_key = ?`,
            [licenseKey]
        );

        if (!license) return null;

        const [payments] = await this.client.db.query(
            `SELECT * FROM payments WHERE license_id = ? ORDER BY created_at DESC`,
            [license.id]
        );

        return {
            license,
            payments,
            tierInfo: this.features[license.tier] || null,
            isActive: license.status === 'active' && 
                     (!license.expires_at || new Date(license.expires_at) > new Date())
        };
    }

    async getServerPremiumStats() {
        const stats = await this.client.db.query(`
            SELECT 
                COUNT(*) as total_premium_servers,
                SUM(CASE WHEN premium_tier = 'monthly' THEN 1 ELSE 0 END) as monthly,
                SUM(CASE WHEN premium_tier = 'yearly' THEN 1 ELSE 0 END) as yearly,
                SUM(CASE WHEN premium_tier = 'lifetime' THEN 1 ELSE 0 END) as lifetime,
                SUM(CASE WHEN expires_at < NOW() THEN 1 ELSE 0 END) as expired
            FROM premium_features 
            WHERE is_premium = 1
        `);

        const revenue = await this.client.db.query(`
            SELECT 
                SUM(amount) as total_revenue,
                COUNT(*) as total_payments,
                provider
            FROM payments 
            WHERE status = 'completed'
            GROUP BY provider
        `);

        return {
            servers: stats[0] || {},
            revenue: revenue || []
        };
    }
}

module.exports = PremiumManager;
