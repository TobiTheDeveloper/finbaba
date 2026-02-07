// Pricing and subscription tiers configuration

const PRICING_TIERS = {
    FREE: {
        id: 'free',
        name: 'Free',
        price: 0,
        priceMonthly: 0,
        priceYearly: 0,
        features: {
            uploadsPerMonth: 3,
            historicalDataDays: 30,
            savingsGoals: 1,
            exportData: false,
            advancedAnalytics: false,
            budgetAlerts: false,
            multiAccount: false,
            prioritySupport: false,
            apiAccess: false,
            customCategories: false,
            aiRecommendations: false
        },
        displayFeatures: [
            'Up to 3 bank statement uploads/month',
            'Last 30 days of transaction data',
            'Basic expense tracking',
            'Simple charts & visualizations',
            '1 savings goal',
            'Email support'
        ]
    },
    PRO: {
        id: 'pro',
        name: 'Pro',
        priceMonthly: 9.99,
        priceYearly: 99,
        stripePriceMonthly: 'price_pro_monthly', // Replace with actual Stripe price ID
        stripePriceYearly: 'price_pro_yearly',
        popular: true,
        features: {
            uploadsPerMonth: -1, // unlimited
            historicalDataDays: -1, // unlimited
            savingsGoals: -1, // unlimited
            exportData: true,
            advancedAnalytics: true,
            budgetAlerts: true,
            multiAccount: true,
            prioritySupport: true,
            apiAccess: false,
            customCategories: true,
            aiRecommendations: false
        },
        displayFeatures: [
            '✨ Unlimited bank statement uploads',
            '✨ Unlimited transaction history',
            'Advanced analytics & insights',
            'Custom categories and tags',
            'Unlimited savings goals',
            'Budget alerts & notifications',
            'Export data (CSV, PDF, Excel)',
            'Multi-account tracking',
            'Priority email support'
        ]
    },
    PREMIUM: {
        id: 'premium',
        name: 'Premium',
        priceMonthly: 19.99,
        priceYearly: 199,
        stripePriceMonthly: 'price_premium_monthly',
        stripePriceYearly: 'price_premium_yearly',
        features: {
            uploadsPerMonth: -1,
            historicalDataDays: -1,
            savingsGoals: -1,
            exportData: true,
            advancedAnalytics: true,
            budgetAlerts: true,
            multiAccount: true,
            prioritySupport: true,
            apiAccess: true,
            customCategories: true,
            aiRecommendations: true,
            billNegotiation: true,
            investmentTracking: true,
            taxOptimization: true,
            automatedReports: true
        },
        displayFeatures: [
            '🚀 Everything in Pro, plus:',
            'AI-powered financial recommendations',
            'Bill negotiation suggestions',
            'Investment tracking integration',
            'Tax optimization insights',
            'Automated expense reports',
            'API access (1,000 calls/month)',
            'Dedicated support',
            'Custom integrations'
        ]
    },
    BUSINESS: {
        id: 'business',
        name: 'Business',
        priceMonthly: 49.99,
        priceYearly: 499,
        stripePriceMonthly: 'price_business_monthly',
        stripePriceYearly: 'price_business_yearly',
        features: {
            uploadsPerMonth: -1,
            historicalDataDays: -1,
            savingsGoals: -1,
            exportData: true,
            advancedAnalytics: true,
            budgetAlerts: true,
            multiAccount: true,
            prioritySupport: true,
            apiAccess: true,
            customCategories: true,
            aiRecommendations: true,
            billNegotiation: true,
            investmentTracking: true,
            taxOptimization: true,
            automatedReports: true,
            multiUser: 10,
            teamCollaboration: true,
            rbac: true,
            sso: true,
            customBranding: true,
            dedicatedManager: true
        },
        displayFeatures: [
            '💼 Everything in Premium, plus:',
            'Multi-user accounts (up to 10 users)',
            'Team collaboration features',
            'Advanced reporting & dashboards',
            'Role-based permissions',
            'SSO (Single Sign-On)',
            'Custom branding',
            'API access (10,000 calls/month)',
            'Dedicated account manager'
        ]
    }
};

// Affiliate partner configurations
const AFFILIATE_PARTNERS = {
    CREDIT_CARDS: [
        {
            id: 'chase_sapphire',
            name: 'Chase Sapphire Preferred',
            type: 'credit_card',
            commission: 150,
            link: 'https://affiliate.chase.com/...',
            conditions: {
                minSpending: 1000,
                categories: ['Shopping', 'Entertainment']
            },
            benefits: '2X points on travel and dining',
            recommendationText: 'Based on your spending, you could earn $500+ in rewards annually'
        },
        {
            id: 'amex_cash',
            name: 'American Express Cash Back',
            type: 'credit_card',
            commission: 100,
            link: 'https://affiliate.americanexpress.com/...',
            conditions: {
                minSpending: 500
            },
            benefits: '3% cash back on groceries',
            recommendationText: 'Save $240/year on grocery spending'
        }
    ],
    SAVINGS_ACCOUNTS: [
        {
            id: 'marcus',
            name: 'Marcus by Goldman Sachs',
            type: 'savings',
            commission: 75,
            link: 'https://affiliate.marcus.com/...',
            apy: 4.5,
            minBalance: 0,
            recommendationText: 'Earn 10x more than traditional savings accounts'
        },
        {
            id: 'ally',
            name: 'Ally Bank High-Yield Savings',
            type: 'savings',
            commission: 50,
            link: 'https://affiliate.ally.com/...',
            apy: 4.35,
            minBalance: 0,
            recommendationText: 'No minimum balance, high APY'
        }
    ],
    INVESTMENT_PLATFORMS: [
        {
            id: 'betterment',
            name: 'Betterment',
            type: 'investment',
            commission: 50,
            link: 'https://affiliate.betterment.com/...',
            minInvestment: 0,
            recommendationText: 'Start investing with $0 minimum'
        },
        {
            id: 'wealthfront',
            name: 'Wealthfront',
            type: 'investment',
            commission: 50,
            link: 'https://affiliate.wealthfront.com/...',
            minInvestment: 500,
            recommendationText: 'Automated investing with tax optimization'
        }
    ]
};

// Add-on products
const ADDON_PRODUCTS = {
    ANNUAL_REPORT: {
        id: 'annual_report',
        name: 'Annual Financial Health Report',
        price: 29.99,
        stripePriceId: 'price_annual_report',
        description: 'Comprehensive year-end analysis with tax optimization and investment recommendations',
        features: [
            'Complete financial year review',
            'Tax optimization strategies',
            'Investment recommendations',
            'Personalized savings plan',
            'PDF download'
        ]
    },
    COACHING_SESSION: {
        id: 'coaching_session',
        name: 'Financial Coaching Session',
        price: 149.99,
        stripePriceId: 'price_coaching',
        description: '1-on-1 video consultation with certified financial planner',
        features: [
            '60-minute video call',
            'Certified financial planner',
            'Personalized action plan',
            'Follow-up email summary',
            'Priority scheduling'
        ]
    },
    CUSTOM_INTEGRATION: {
        id: 'custom_integration',
        name: 'Custom Integration Setup',
        price: 199,
        stripePriceId: 'price_custom_integration',
        description: 'Custom integration with your bank or financial platform',
        features: [
            'Direct bank API integration',
            'Custom data parsing',
            'Automated sync setup',
            'Testing and validation',
            '30-day support'
        ]
    }
};

module.exports = {
    PRICING_TIERS,
    AFFILIATE_PARTNERS,
    ADDON_PRODUCTS
};
