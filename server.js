// server.js - Node.js Backend for Finbaba
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const PDFParser = require('pdf-parse');
const XLSX = require('xlsx');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve your HTML/CSS/JS files

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

// Upload and process bank statement
app.post('/api/upload', upload.single('bankStatement'), async (req, res) => {
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
        
        // Store in memory (replace with database)
        const userId = req.body.userId || 'default';
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

// Get financial data
app.get('/api/financial-data/:userId', (req, res) => {
    const userId = req.params.userId || 'default';
    const data = users[userId];
    
    if (!data) {
        return res.status(404).json({ error: 'No data found for user' });
    }
    
    res.json(data);
});

// Add savings goal
app.post('/api/savings-goal', (req, res) => {
    const { userId, name, target, deadline } = req.body;
    
    if (!users[userId]) {
        users[userId] = { savingsGoals: [] };
    }
    
    if (!users[userId].savingsGoals) {
        users[userId].savingsGoals = [];
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

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Finbaba API is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Finbaba server running on http://localhost:${PORT}`);
    console.log(`📊 Upload endpoint: http://localhost:${PORT}/api/upload`);
});