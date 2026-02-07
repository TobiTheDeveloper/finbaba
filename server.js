// server.js - Node.js Backend for Finbaba
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const PDFParser = require('pdf-parse');
const XLSX = require('xlsx');

// Import authentication and routes
const { authenticate, checkUsageLimit, optionalAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use('/api/webhook', express.raw({ type: 'application/json' })); // Stripe webhook needs raw body
app.use(express.json());
app.use(express.static('public')); // Serve your HTML/CSS/JS files

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);

// Configure file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /csv|pdf|xlsx|xls/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type. Only CSV, PDF, and Excel files are allowed.'));
    }
});

// In-memory storage (replace with database in production)
let users = {};

// Helper function to categorize transactions
function categorizeTransaction(description) {
    const desc = description.toLowerCase();
    
    const categories = {
        'Food & Dining': ['restaurant', 'food', 'grocery', 'cafe', 'dining', 'starbucks', 'mcdonald', 'pizza', 'sushi'],
        'Transportation': ['gas', 'uber', 'lyft', 'transit', 'parking', 'taxi', 'fuel', 'shell', 'chevron'],
        'Entertainment': ['movie', 'netflix', 'spotify', 'game', 'entertainment', 'hulu', 'disney', 'xbox', 'playstation'],
        'Bills & Utilities': ['electric', 'water', 'internet', 'phone', 'utility', 'rent', 'mortgage', 'insurance', 'verizon', 'att'],
        'Shopping': ['amazon', 'store', 'shop', 'mall', 'target', 'walmart', 'ebay', 'clothing', 'shoes'],
        'Healthcare': ['doctor', 'hospital', 'pharmacy', 'medical', 'health', 'cvs', 'walgreens', 'dentist']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => desc.includes(keyword))) {
            return category;
        }
    }
    return 'Other';
}

// Parse CSV file
async function parseCSVFile(filePath) {
    return new Promise((resolve, reject) => {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const transactions = results.data.map(row => {
                    // Handle different CSV formats
                    const date = row.Date || row.date || row.DATE;
                    const description = row.Description || row.description || row.Merchant || row.merchant;
                    const amount = parseFloat(row.Amount || row.amount || row.Debit || row.Credit || 0);
                    const type = row.Type || row.type || (amount > 0 ? 'credit' : 'debit');
                    
                    return {
                        date: new Date(date),
                        description: description,
                        amount: Math.abs(amount),
                        type: type.toLowerCase(),
                        category: categorizeTransaction(description)
                    };
                }).filter(t => t.description && t.amount);
                
                resolve(transactions);
            },
            error: (error) => reject(error)
        });
    });
}

// Parse PDF file
async function parsePDFFile(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await PDFParser(dataBuffer);
    
    // This is a simplified parser - real bank PDFs need custom parsing per bank
    const lines = data.text.split('\n');
    const transactions = [];
    
    // Example regex pattern - adjust based on your bank's PDF format
    const transactionPattern = /(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})/g;
    
    lines.forEach(line => {
        const matches = [...line.matchAll(transactionPattern)];
        matches.forEach(match => {
            const [, date, description, amount] = match;
            const numAmount = parseFloat(amount.replace(/[$,]/g, ''));
            
            transactions.push({
                date: new Date(date),
                description: description.trim(),
                amount: Math.abs(numAmount),
                type: numAmount < 0 ? 'debit' : 'credit',
                category: categorizeTransaction(description)
            });
        });
    });
    
    return transactions;
}

// Parse Excel file
async function parseExcelFile(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    return jsonData.map(row => {
        const date = row.Date || row.date || row.DATE;
        const description = row.Description || row.description || row.Merchant;
        const amount = parseFloat(row.Amount || row.amount || row.Debit || row.Credit || 0);
        const type = row.Type || row.type || (amount > 0 ? 'credit' : 'debit');
        
        return {
            date: new Date(date),
            description: description,
            amount: Math.abs(amount),
            type: type.toLowerCase(),
            category: categorizeTransaction(description)
        };
    }).filter(t => t.description && t.amount);
}

// Process transactions to calculate insights
function processTransactions(transactions) {
    const categories = {
        'Food & Dining': 0,
        'Transportation': 0,
        'Entertainment': 0,
        'Bills & Utilities': 0,
        'Shopping': 0,
        'Healthcare': 0,
        'Other': 0
    };
    
    let totalIncome = 0;
    let totalExpenses = 0;
    
    // Calculate totals
    transactions.forEach(t => {
        if (t.type === 'credit') {
            totalIncome += t.amount;
        } else {
            totalExpenses += t.amount;
            categories[t.category] = (categories[t.category] || 0) + t.amount;
        }
    });
    
    // Generate monthly trends
    const monthlyData = {};
    transactions.forEach(t => {
        const month = t.date.toLocaleString('default', { month: 'short' });
        if (!monthlyData[month]) {
            monthlyData[month] = { income: 0, spending: 0 };
        }
        if (t.type === 'credit') {
            monthlyData[month].income += t.amount;
        } else {
            monthlyData[month].spending += t.amount;
        }
    });
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const monthlyTrends = months.map(month => ({
        month,
        income: monthlyData[month]?.income || 0,
        spending: monthlyData[month]?.spending || 0
    }));
    
    // Generate insights
    const insights = [];
    const savingsRate = ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1);
    
    insights.push({
        type: 'savings_rate',
        message: `Your savings rate is ${savingsRate}%. You're saving $${(totalIncome - totalExpenses).toFixed(2)} per month.`
    });
    
    // Find highest spending category
    const highestCategory = Object.entries(categories).reduce((a, b) => a[1] > b[1] ? a : b);
    insights.push({
        type: 'top_category',
        message: `Your highest spending category is ${highestCategory[0]} at $${highestCategory[1].toFixed(2)}.`
    });
    
    // Spending recommendation
    if (categories['Food & Dining'] > totalExpenses * 0.2) {
        insights.push({
            type: 'recommendation',
            message: `Consider reducing dining expenses by 15% to save an additional $${(categories['Food & Dining'] * 0.15).toFixed(2)}/month.`
        });
    }
    
    return {
        totalBalance: totalIncome - totalExpenses,
        monthlyIncome: totalIncome,
        monthlySpending: totalExpenses,
        categories,
        monthlyTrends,
        insights,
        transactions
    };
}

// API Endpoints

// Upload and process bank statement (with authentication and usage limits)
app.post('/api/upload', authenticate, checkUsageLimit('upload'), upload.single('bankStatement'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const filePath = req.file.path;
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        
        let transactions = [];
        
        // Parse based on file type
        if (fileExt === '.csv') {
            transactions = await parseCSVFile(filePath);
        } else if (fileExt === '.pdf') {
            transactions = await parsePDFFile(filePath);
        } else if (fileExt === '.xlsx' || fileExt === '.xls') {
            transactions = await parseExcelFile(filePath);
        }
        
        // Process transactions
        const financialData = processTransactions(transactions);
        
        // Add AI recommendations for premium users
        if (req.user.subscription?.tier === 'premium' || req.user.subscription?.tier === 'business') {
            financialData.aiRecommendations = generateAIRecommendations(financialData);
        }
        
        // Add affiliate recommendations
        financialData.affiliateRecommendations = generateAffiliateRecommendations(financialData);
        
        // Store in memory (replace with database)
        const userId = req.user.id;
        users[userId] = financialData;
        
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        
        res.json({
            success: true,
            message: 'Bank statement processed successfully',
            data: financialData
        });
        
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ 
            error: 'Error processing file',
            details: error.message 
        });
    }
});

// Get financial data (authenticated)
app.get('/api/financial-data', authenticate, (req, res) => {
    const userId = req.user.id;
    const data = users[userId];
    
    if (!data) {
        return res.status(404).json({ error: 'No data found for user' });
    }
    
    // Filter data based on subscription tier
    const subscription = req.user.subscription || { tier: 'free' };
    
    if (subscription.tier === 'free') {
        // Limit historical data to 30 days for free users
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (data.transactions) {
            data.transactions = data.transactions.filter(t => 
                new Date(t.date) >= thirtyDaysAgo
            );
        }
    }
    
    res.json(data);
});

// Add savings goal (with tier limits)
app.post('/api/savings-goal', authenticate, (req, res) => {
    const { name, target, deadline } = req.body;
    const userId = req.user.id;
    const subscription = req.user.subscription || { tier: 'free' };
    
    if (!users[userId]) {
        users[userId] = { savingsGoals: [] };
    }
    
    if (!users[userId].savingsGoals) {
        users[userId].savingsGoals = [];
    }
    
    // Check limits for free tier
    if (subscription.tier === 'free' && users[userId].savingsGoals.length >= 1) {
        return res.status(403).json({
            error: 'Limit reached',
            message: 'Free tier allows only 1 savings goal. Upgrade to Pro for unlimited goals.',
            upgradeUrl: '/pricing.html'
        });
    }
    
    const goal = {
        id: Date.now(),
        name,
        target: parseFloat(target),
        current: 0,
        deadline
    };
    
    users[userId].savingsGoals.push(goal);
    
    res.json({
        success: true,
        goal
    });
});

// Update savings goal progress
app.put('/api/savings-goal/:goalId', (req, res) => {
    const { userId, amount } = req.body;
    const goalId = parseInt(req.params.goalId);
    
    if (!users[userId] || !users[userId].savingsGoals) {
        return res.status(404).json({ error: 'Goal not found' });
    }
    
    const goal = users[userId].savingsGoals.find(g => g.id === goalId);
    if (!goal) {
        return res.status(404).json({ error: 'Goal not found' });
    }
    
    goal.current = Math.min(parseFloat(amount), goal.target);
    
    res.json({
        success: true,
        goal
    });
});

// Export data (Premium feature)
app.get('/api/export/:format', authenticate, checkUsageLimit('export'), (req, res) => {
    const format = req.params.format; // csv, pdf, or excel
    const userId = req.user.id;
    const data = users[userId];
    
    if (!data) {
        return res.status(404).json({ error: 'No data found' });
    }
    
    try {
        if (format === 'csv') {
            const csv = convertToCSV(data.transactions);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=finbaba-export.csv');
            res.send(csv);
        } else if (format === 'excel') {
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(data.transactions);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=finbaba-export.xlsx');
            res.send(buffer);
        } else {
            res.status(400).json({ error: 'Invalid format. Use csv or excel' });
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Export failed' });
    }
});

// Get affiliate recommendations
app.get('/api/affiliate-recommendations', authenticate, (req, res) => {
    const userId = req.user.id;
    const data = users[userId];
    
    if (!data) {
        return res.status(404).json({ recommendations: [] });
    }
    
    const recommendations = generateAffiliateRecommendations(data);
    res.json({ recommendations });
});

// Track affiliate click (for analytics and commission tracking)
app.post('/api/affiliate-click', authenticate, (req, res) => {
    const { partnerId, recommendationId } = req.body;
    const userId = req.user.id;
    
    // Log the click (in production, store this in database)
    console.log(`Affiliate click: User ${userId} clicked ${partnerId} (${recommendationId})`);
    
    // You would track this for commission calculations
    res.json({ success: true });
});

// Get AI recommendations (Premium feature)
app.get('/api/ai-recommendations', authenticate, (req, res) => {
    const subscription = req.user.subscription || { tier: 'free' };
    
    if (subscription.tier !== 'premium' && subscription.tier !== 'business') {
        return res.status(403).json({
            error: 'Premium feature',
            message: 'AI recommendations require Premium subscription',
            upgradeUrl: '/pricing.html'
        });
    }
    
    const userId = req.user.id;
    const data = users[userId];
    
    if (!data) {
        return res.status(404).json({ recommendations: [] });
    }
    
    const recommendations = generateAIRecommendations(data);
    res.json({ recommendations });
});

// Helper function to convert transactions to CSV
function convertToCSV(transactions) {
    const headers = ['Date', 'Description', 'Amount', 'Type', 'Category'];
    const rows = transactions.map(t => [
        t.date.toISOString().split('T')[0],
        t.description,
        t.amount,
        t.type,
        t.category
    ]);
    
    const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    return csv;
}

// Generate AI-powered recommendations (Premium feature)
function generateAIRecommendations(financialData) {
    const recommendations = [];
    const { monthlyIncome, monthlySpending, categories, totalBalance } = financialData;
    
    // Savings rate analysis
    const savingsRate = ((monthlyIncome - monthlySpending) / monthlyIncome * 100);
    if (savingsRate < 20) {
        recommendations.push({
            type: 'savings',
            priority: 'high',
            title: 'Increase Your Savings Rate',
            description: `Your current savings rate is ${savingsRate.toFixed(1)}%. Financial experts recommend saving at least 20% of your income.`,
            action: `Try to save an additional $${((monthlyIncome * 0.20) - (monthlyIncome - monthlySpending)).toFixed(2)} per month.`,
            potentialSavings: ((monthlyIncome * 0.20) - (monthlyIncome - monthlySpending)) * 12
        });
    }
    
    // Category-specific recommendations
    const foodSpending = categories['Food & Dining'] || 0;
    if (foodSpending > monthlyIncome * 0.15) {
        recommendations.push({
            type: 'category_optimization',
            priority: 'medium',
            title: 'Reduce Dining Expenses',
            description: `You're spending ${((foodSpending / monthlyIncome) * 100).toFixed(1)}% of your income on food and dining.`,
            action: `Cooking at home 3 more times per week could save you $${(foodSpending * 0.25).toFixed(2)} monthly.`,
            potentialSavings: foodSpending * 0.25 * 12
        });
    }
    
    // Emergency fund recommendation
    const emergencyFundTarget = monthlySpending * 6;
    if (totalBalance < emergencyFundTarget) {
        recommendations.push({
            type: 'emergency_fund',
            priority: 'high',
            title: 'Build Your Emergency Fund',
            description: `You need $${emergencyFundTarget.toFixed(2)} for a 6-month emergency fund.`,
            action: `You're $${(emergencyFundTarget - totalBalance).toFixed(2)} away from your goal. Save $${((emergencyFundTarget - totalBalance) / 12).toFixed(2)} monthly.`,
            potentialSavings: 0
        });
    }
    
    // Investment recommendation
    if (savingsRate > 20 && totalBalance > emergencyFundTarget) {
        recommendations.push({
            type: 'investment',
            priority: 'medium',
            title: 'Start Investing Your Surplus',
            description: 'You have a healthy emergency fund and good savings rate.',
            action: `Consider investing $${((monthlyIncome - monthlySpending) * 0.5).toFixed(2)} monthly in index funds or robo-advisors.`,
            potentialSavings: ((monthlyIncome - monthlySpending) * 0.5 * 12 * 0.08) // 8% assumed return
        });
    }
    
    // Subscription audit
    const billsCategory = categories['Bills & Utilities'] || 0;
    if (billsCategory > 0) {
        recommendations.push({
            type: 'bill_optimization',
            priority: 'low',
            title: 'Audit Your Subscriptions',
            description: `You're spending $${billsCategory.toFixed(2)} on bills and utilities.`,
            action: 'Review subscriptions and negotiate better rates. Many people save 10-20% by calling providers.',
            potentialSavings: billsCategory * 0.15 * 12
        });
    }
    
    return recommendations;
}

// Generate affiliate recommendations based on spending patterns
function generateAffiliateRecommendations(financialData) {
    const recommendations = [];
    const { monthlySpending, categories, totalBalance } = financialData;
    
    // Credit card recommendations based on spending
    if (monthlySpending > 1000) {
        const topCategory = Object.entries(categories).reduce((a, b) => a[1] > b[1] ? a : b);
        
        if (topCategory[0] === 'Food & Dining' || topCategory[0] === 'Shopping') {
            recommendations.push({
                id: 'amex_cash',
                type: 'credit_card',
                partner: 'American Express',
                product: 'Cash Back Card',
                icon: '💳',
                title: 'Earn More Cash Back on Your Spending',
                description: `Based on your ${topCategory[0]} spending of $${topCategory[1].toFixed(2)}/month, you could earn $${(topCategory[1] * 0.03 * 12).toFixed(2)}/year in cash back.`,
                benefits: ['3% cash back on groceries', '2% at gas stations', '$200 welcome bonus'],
                ctaText: 'Apply Now',
                estimatedValue: topCategory[1] * 0.03 * 12,
                affiliateLink: 'https://affiliate.americanexpress.com/...'
            });
        }
    }
    
    // High-yield savings account recommendation
    if (totalBalance > 5000) {
        const currentInterest = totalBalance * 0.005; // Assume 0.5% at traditional bank
        const highYieldInterest = totalBalance * 0.045; // 4.5% APY
        const difference = highYieldInterest - currentInterest;
        
        recommendations.push({
            id: 'marcus_savings',
            type: 'savings_account',
            partner: 'Marcus by Goldman Sachs',
            product: 'High-Yield Savings',
            icon: '🏦',
            title: 'Earn 10x More Interest on Your Savings',
            description: `With $${totalBalance.toFixed(2)} in savings, you could earn $${difference.toFixed(2)} more per year with a high-yield savings account.`,
            benefits: ['4.5% APY', 'No minimum balance', 'FDIC insured', 'No monthly fees'],
            ctaText: 'Open Account',
            estimatedValue: difference,
            affiliateLink: 'https://affiliate.marcus.com/...'
        });
    }
    
    // Investment platform recommendation
    if (totalBalance > 10000) {
        recommendations.push({
            id: 'betterment',
            type: 'investment',
            partner: 'Betterment',
            product: 'Automated Investing',
            icon: '📈',
            title: 'Start Investing for Your Future',
            description: 'You have strong savings. Consider investing for long-term wealth building.',
            benefits: ['Automated portfolio management', 'Tax-loss harvesting', 'No minimum investment', '0.25% annual fee'],
            ctaText: 'Start Investing',
            estimatedValue: totalBalance * 0.08, // Assumed 8% annual return
            affiliateLink: 'https://affiliate.betterment.com/...'
        });
    }
    
    return recommendations;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Finbaba API is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Finbaba server running on http://localhost:${PORT}`);
    console.log(`📊 Upload endpoint: http://localhost:${PORT}/api/upload`);
    console.log(`💰 Monetization features enabled`);
});