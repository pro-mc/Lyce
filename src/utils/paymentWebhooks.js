const crypto = require('crypto');

class PaymentWebhooks {
    constructor(client) {
        this.client = client;
        this.stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    }

    async handleStripeWebhook(payload, signature) {
        try {
            const event = this.verifyStripeSignature(payload, signature);
            
            switch (event.type) {
                case 'checkout.session.completed':
                    await this.handleCheckoutCompleted(event.data.object);
                    break;
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionCanceled(event.data.object);
                    break;
                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
            }
            
            return { success: true };
        } catch (error) {
            console.error('Webhook error:', error);
            return { success: false, error: error.message };
        }
    }

    verifyStripeSignature(payload, signature) {
        const expectedSignature = crypto
            .createHmac('sha256', this.stripeWebhookSecret)
            .update(payload, 'utf8')
            .digest('hex');
            
        if (signature !== expectedSignature) {
            throw new Error('Invalid signature');
        }
        
        return JSON.parse(payload);
    }

    async handleCheckoutCompleted(session) {
        const { metadata, customer_details } = session;
        const guildId = metadata.guild_id;
        const discordUserId = metadata.discord_user_id;
        const tier = metadata.tier;

        if (!guildId || !discordUserId || !tier) {
            throw new Error('Missing metadata in session');
        }

        const license = await this.client.premiumManager.createLicense(tier, discordUserId);
        const result = await this.client.premiumManager.activateLicense(guildId, license.licenseKey, discordUserId);

        if (result.success) {
            await this.client.db.query(
                `INSERT INTO payments 
                 (id, user_id, license_id, amount, currency, provider, provider_payment_id, status) 
                 VALUES (?, ?, ?, ?, ?, 'stripe', ?, 'completed')`,
                [
                    crypto.randomBytes(10).toString('hex'),
                    discordUserId,
                    license.licenseId,
                    session.amount_total / 100,
                    session.currency,
                    session.id
                ]
            );

            try {
                const user = await this.client.users.fetch(discordUserId);
                await user.send({
                    embeds: [{
                        color: 0x00ff00,
                        title: 'Payment Confirmed',
                        description: `Your ${license.tier} premium subscription has been activated!`,
                        fields: [
                            { name: 'Server', value: guildId },
                            { name: 'Amount', value: `$${(session.amount_total / 100).toFixed(2)}` },
                            { name: 'License Key', value: `\`${license.licenseKey}\`` },
                            { name: 'Receipt', value: `[View Receipt](${session.invoice_url || '#'})` }
                        ]
                    }]
                });
            } catch (error) {
                console.error('Failed to notify user:', error);
            }
        }
    }

    async handleSubscriptionCanceled(subscription) {
        const metadata = subscription.metadata;
        if (metadata && metadata.license_key) {
            const licenseInfo = await this.client.premiumManager.getLicenseInfo(metadata.license_key);
            if (licenseInfo) {
                await this.client.premiumManager.revokeLicense(licenseInfo.license.activated_guild_id);
            }
        }
    }

    async handlePaymentFailed(invoice) {
        const customerId = invoice.customer;
    }
}

module.exports = PaymentWebhooks;
