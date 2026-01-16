// src/utils/PremiumManager.js
const crypto = require('crypto');
const config = require('../../config/config');
const { v4: uuidv4 } = require('uuid');

class PremiumManager {
    constructor(client) {
        this.client = client;
        
        this.features = {
            monthly: {
                name: 'Monthly Premium',
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

    async checkExpirations() {
        console.log('🔍 Checking for expired premium subscriptions...');
        
        try {
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
        } catch (error) {
            console.error('Error checking expirations:', error);
            return 0;
        }
    }

    async revokePremium(guildId, reason = 'manual') {
        try {
            // Deactivate license
            await this.client.db.query(
                `UPDATE premium_licenses 
                 SET status = ? 
                 WHERE activated_guild_id = ? AND status = 'active'`,
                [reason === 'expired' ? 'expired' : 'revoked', guildId]
            );

            // Remove premium features
            await this.client.db.query(
                `UPDATE premium_features 
                 SET is_premium = 0, expires_at = NOW() 
                 WHERE guild_id = ?`,
                [guildId]
            );

            console.log(`📛 Premium revoked for guild ${guildId} (${reason})`);
            return { success: true, message: `Premium revoked for guild ${guildId}` };

        } catch (error) {
            console.error('Failed to revoke premium:', error);
            return { success: false, message: 'Failed to revoke premium.' };
        }
    }

    async checkGuildPremium(guildId) {
        try {
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
        } catch (error) {
            console.error('Error checking guild premium:', error);
            return { isPremium: false, error: true };
        }
    }

    async getLicenseInfo(licenseKey) {
        try {
            const [rows] = await this.client.db.query(
                'SELECT * FROM premium_licenses WHERE license_key = ?',
                [licenseKey]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('Error getting license info:', error);
            return null;
        }
    }
    
    // Add getLicenseByGuildId method
    async getLicenseByGuildId(guildId) {
        try {
            const [rows] = await this.client.db.query(
                'SELECT * FROM premium_licenses WHERE activated_guild_id = ? AND status = "active"',
                [guildId]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('Error getting license by guild ID:', error);
            return null;
        }
    }
    
    // Add revokeLicense method (if not exists)
    async revokeLicense(guildId) {
        return await this.revokePremium(guildId, 'manual');
    }
    
    // Add getAllLicenses method (optional, for listing)
    async getAllLicenses(status = null) {
        try {
            let query = 'SELECT * FROM premium_licenses';
            const params = [];
            
            if (status) {
                query += ' WHERE status = ?';
                params.push(status);
            }
            
            query += ' ORDER BY created_at DESC';
            const [rows] = await this.client.db.query(query, params);
            return rows;
        } catch (error) {
            console.error('Error getting all licenses:', error);
            return [];
        }
    }
    
    async checkPremiumStatus(guildId) {
        try {
            // Use checkGuildPremium which already exists
            const result = await this.checkGuildPremium(guildId);
            
            if (result.isPremium) {
                return {
                    isPremium: true,
                    tier: result.tier,
                    tierName: result.tierName,
                    features: result.features || [],
                    activatedAt: result.activatedAt,
                    expiresAt: result.expiresAt,
                    licenseKey: result.licenseKey
                };
            } else {
                return {
                    isPremium: false,
                    tier: 'free',
                    features: [],
                    activatedAt: null,
                    expiresAt: null
                };
            }
        } catch (error) {
            console.error('Error in checkPremiumStatus:', error);
            return {
                isPremium: false,
                tier: 'free',
                features: [],
                activatedAt: null,
                expiresAt: null
            };
        }
    }

    async hasFeature(guildId, featureName) {
        const premium = await this.checkGuildPremium(guildId);
        if (!premium.isPremium) return false;
        
        return premium.features.includes(featureName);
    }

    async createLicense(tier, purchaserId = null, adminNote = '') {
        try {
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
        } catch (error) {
            console.error('Error creating license:', error);
            throw error;
        }
    }

    async activateLicense(guildId, licenseKey, activatorId) {
        try {
            // Verify guild exists
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

                await connection.commit();
                console.log(`✅ License ${licenseKey} activated for guild ${guildId}`);

                return {
                    success: true,
                    message: `✅ **${tierData.name}** activated successfully for **${guild.name}**!`,
                    tier: tierData.name,
                    expiresAt: expiresAt ? expiresAt.toISOString() : null,
                    features: tierData.features
                };

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('License activation failed:', error);
            return { 
                success: false, 
                message: 'Failed to activate license. Please try again or contact support.' 
            };
        }
    }
}

module.exports = PremiumManager;
