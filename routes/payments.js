// Payment and subscription routes

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key');
const { authenticate, users } = require('../middleware/auth');

const router = express.Router();

// Stripe price IDs (replace with your actual Stripe price IDs)
const PRICE_IDS = {
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly',
    premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly',
    premium_yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY || 'price_premium_yearly',
    business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || 'price_business_monthly',
    business_yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY || 'price_business_yearly'
};

// Create checkout session
router.post('/create-checkout-session', authenticate, async (req, res) => {
    try {
        const { plan, billing } = req.body; // plan: 'pro', 'premium', 'business'; billing: 'monthly', 'yearly'
        const userId = req.user.id;
        
        const priceKey = `${plan}_${billing}`;
        const priceId = PRICE_IDS[priceKey];
        
        if (!priceId) {
            return res.status(400).json({ error: 'Invalid plan or billing period' });
        }
        
        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            customer_email: req.user.email,
            client_reference_id: userId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.APP_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/pricing.html`,
            metadata: {
                userId,
                plan,
                billing
            }
        });
        
        res.json({ 
            success: true,
            sessionId: session.id,
            url: session.url 
        });
        
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// Webhook for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        
        // Handle different event types
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                await handleSuccessfulCheckout(session);
                break;
                
            case 'customer.subscription.updated':
                const subscription = event.data.object;
                await handleSubscriptionUpdate(subscription);
                break;
                
            case 'customer.subscription.deleted':
                const deletedSub = event.data.object;
                await handleSubscriptionCancellation(deletedSub);
                break;
                
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        
        res.json({ received: true });
        
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});

// Handle successful checkout
async function handleSuccessfulCheckout(session) {
    const userId = session.client_reference_id || session.metadata.userId;
    const user = users.get(userId);
    
    if (!user) {
        console.error('User not found:', userId);
        return;
    }
    
    const plan = session.metadata.plan;
    const billing = session.metadata.billing;
    
    user.subscription = {
        tier: plan,
        status: 'active',
        billing: billing,
        startDate: new Date().toISOString(),
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription
    };
    
    users.set(userId, user);
    console.log(`Subscription activated for user ${userId}: ${plan} (${billing})`);
}

// Handle subscription updates
async function handleSubscriptionUpdate(subscription) {
    // Find user by Stripe customer ID
    let userId = null;
    for (const [id, user] of users.entries()) {
        if (user.subscription?.stripeCustomerId === subscription.customer) {
            userId = id;
            break;
        }
    }
    
    if (!userId) {
        console.error('User not found for customer:', subscription.customer);
        return;
    }
    
    const user = users.get(userId);
    user.subscription.status = subscription.status;
    users.set(userId, user);
    
    console.log(`Subscription updated for user ${userId}: ${subscription.status}`);
}

// Handle subscription cancellation
async function handleSubscriptionCancellation(subscription) {
    // Find user by Stripe subscription ID
    let userId = null;
    for (const [id, user] of users.entries()) {
        if (user.subscription?.stripeSubscriptionId === subscription.id) {
            userId = id;
            break;
        }
    }
    
    if (!userId) {
        console.error('User not found for subscription:', subscription.id);
        return;
    }
    
    const user = users.get(userId);
    user.subscription = {
        tier: 'free',
        status: 'active',
        startDate: new Date().toISOString(),
        previousTier: user.subscription.tier,
        cancelledAt: new Date().toISOString()
    };
    
    users.set(userId, user);
    console.log(`Subscription cancelled for user ${userId}, reverted to free tier`);
}

// Get customer portal
router.post('/customer-portal', authenticate, async (req, res) => {
    try {
        const user = users.get(req.user.id);
        
        if (!user?.subscription?.stripeCustomerId) {
            return res.status(400).json({ error: 'No active subscription' });
        }
        
        const session = await stripe.billingPortal.sessions.create({
            customer: user.subscription.stripeCustomerId,
            return_url: `${process.env.APP_URL || 'http://localhost:3000'}/index.html`
        });
        
        res.json({ url: session.url });
        
    } catch (error) {
        console.error('Portal error:', error);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

// Get subscription status
router.get('/subscription-status', authenticate, (req, res) => {
    const user = users.get(req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
        subscription: user.subscription,
        usage: user.usage
    });
});

module.exports = router;
