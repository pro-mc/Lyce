const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('@paypal/checkout-server-sdk');
const mysql = require('mysql2/promise');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Database connection
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Stripe checkout
app.post('/create-checkout', async (req, res) => {
    const { tier, guildId, discordId } = req.body;
    
    const prices = {
        monthly: 499,
        yearly: 4999,
        lifetime: 6000
    };

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: `Lyce ${tier.charAt(0).toUpperCase() + tier.slice(1)} Premium`,
                    description: `Premium access for your Discord server`
                },
                unit_amount: prices[tier],
            },
            quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.WEBSITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.WEBSITE_URL}/cancel`,
        metadata: {
            guild_id: guildId,
            discord_user_id: discordId,
            tier: tier
        }
    });

    res.json({ url: session.url });
});

// Webhook handler
app.post('/webhook/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // Create license in database
        const [result] = await pool.execute(
            `INSERT INTO premium_licenses 
             (id, license_key, tier, status, purchaser_discord_id) 
             VALUES (?, ?, ?, 'inactive', ?)`,
            [
                `LIC_${Date.now()}`,
                `LYCE-${session.metadata.tier.toUpperCase()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                session.metadata.tier,
                session.metadata.discord_user_id
            ]
        );

        // Send license key via Discord bot (you'll need to implement this)
        // Could use Discord webhook to send DM
    }

    res.json({ received: true });
});

// License validation API
app.get('/api/validate/:licenseKey', async (req, res) => {
    const [rows] = await pool.execute(
        'SELECT * FROM premium_licenses WHERE license_key = ?',
        [req.params.licenseKey]
    );
    
    if (rows.length === 0) {
        return res.json({ valid: false });
    }
    
    res.json({ valid: true, license: rows[0] });
});

app.listen(3000, () => console.log('Website running on port 3000'));
