// Authentication and authorization middleware

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Simple user database (replace with real database)
const users = new Map();

// Authenticate user with JWT
function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Check if user has required subscription tier
function requireSubscription(minTier) {
    const tierLevels = {
        'free': 0,
        'pro': 1,
        'premium': 2,
        'business': 3
    };
    
    return (req, res, next) => {
        const userTier = req.user?.subscription?.tier || 'free';
        const requiredLevel = tierLevels[minTier] || 0;
        const userLevel = tierLevels[userTier] || 0;
        
        if (userLevel < requiredLevel) {
            return res.status(403).json({
                error: 'Upgrade required',
                message: `This feature requires ${minTier} subscription or higher`,
                currentTier: userTier,
                requiredTier: minTier,
                upgradeUrl: '/pricing.html'
            });
        }
        
        next();
    };
}

// Check usage limits
function checkUsageLimit(limitType) {
    return async (req, res, next) => {
        const userId = req.user?.id;
        const user = users.get(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const subscription = user.subscription || { tier: 'free' };
        const limits = getSubscriptionLimits(subscription.tier);
        
        // Get current usage
        const currentUsage = user.usage || {};
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        
        if (!currentUsage[currentMonth]) {
            currentUsage[currentMonth] = {
                uploads: 0,
                apiCalls: 0,
                exports: 0
            };
        }
        
        const monthUsage = currentUsage[currentMonth];
        
        // Check specific limit
        if (limitType === 'upload') {
            if (limits.uploadsPerMonth !== -1 && monthUsage.uploads >= limits.uploadsPerMonth) {
                return res.status(429).json({
                    error: 'Usage limit exceeded',
                    message: `You've reached your monthly upload limit of ${limits.uploadsPerMonth}`,
                    currentUsage: monthUsage.uploads,
                    limit: limits.uploadsPerMonth,
                    upgradeUrl: '/pricing.html'
                });
            }
            monthUsage.uploads++;
        }
        
        if (limitType === 'export') {
            if (!limits.exportData) {
                return res.status(403).json({
                    error: 'Feature not available',
                    message: 'Data export requires Pro subscription or higher',
                    upgradeUrl: '/pricing.html'
                });
            }
        }
        
        if (limitType === 'api') {
            const apiLimit = limits.apiCalls || 0;
            if (apiLimit !== -1 && monthUsage.apiCalls >= apiLimit) {
                return res.status(429).json({
                    error: 'API limit exceeded',
                    message: `You've reached your monthly API limit of ${apiLimit}`,
                    upgradeUrl: '/pricing.html'
                });
            }
            monthUsage.apiCalls++;
        }
        
        // Update usage
        user.usage = currentUsage;
        users.set(userId, user);
        
        next();
    };
}

// Get subscription limits based on tier
function getSubscriptionLimits(tier) {
    const limits = {
        'free': {
            uploadsPerMonth: 3,
            historicalDataDays: 30,
            savingsGoals: 1,
            exportData: false,
            advancedAnalytics: false,
            apiCalls: 0
        },
        'pro': {
            uploadsPerMonth: -1, // unlimited
            historicalDataDays: -1,
            savingsGoals: -1,
            exportData: true,
            advancedAnalytics: true,
            apiCalls: 0
        },
        'premium': {
            uploadsPerMonth: -1,
            historicalDataDays: -1,
            savingsGoals: -1,
            exportData: true,
            advancedAnalytics: true,
            apiCalls: 1000
        },
        'business': {
            uploadsPerMonth: -1,
            historicalDataDays: -1,
            savingsGoals: -1,
            exportData: true,
            advancedAnalytics: true,
            apiCalls: 10000
        }
    };
    
    return limits[tier] || limits['free'];
}

// Optional auth - continues even if not authenticated
function optionalAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (error) {
            // Invalid token, but we continue anyway
        }
    }
    
    next();
}

module.exports = {
    authenticate,
    requireSubscription,
    checkUsageLimit,
    getSubscriptionLimits,
    optionalAuth,
    users,
    JWT_SECRET
};
