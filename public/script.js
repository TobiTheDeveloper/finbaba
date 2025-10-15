// Financial data storage
let financialData = {
    totalBalance: 0,
    monthlyIncome: 0,
    monthlySpending: 0,
    transactions: [],
    categories: {
        'Food & Dining': 0,
        'Transportation': 0,
        'Entertainment': 0,
        'Bills & Utilities': 0,
        'Shopping': 0,
        'Healthcare': 0,
        'Other': 0
    },
    monthlyTrends: [],
    savingsGoals: []
};

// Chart instances
let spendingChart, categoryChart, savingsChart, budgetChart;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeCharts();
    loadSampleData(); // Remove this in production
});

// Event Listeners
function initializeEventListeners() {
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const addGoalBtn = document.getElementById('addGoalBtn');

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    addGoalBtn.addEventListener('click', showAddGoalModal);
}

// File Upload Handler
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    
    try {
        if (fileName.endsWith('.csv')) {
            await parseCSV(file);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            alert('Excel file detected. In production, use a library like SheetJS to parse.');
            // For now, use sample data
            loadSampleData();
        } else if (fileName.endsWith('.pdf')) {
            alert('PDF file detected. In production, use a library like pdf-parse.');
            // For now, use sample data
            loadSampleData();
        } else {
            alert('Unsupported file format. Please upload CSV, Excel, or PDF.');
            return;
        }
        
        processTransactions();
        updateDashboard();
        alert('Bank statement uploaded successfully!');
    } catch (error) {
        console.error('Error processing file:', error);
        alert('Error processing file. Please try again.');
    }
}

// CSV Parser
function parseCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split('\n');
            const transactions = [];
            
            // Skip header row
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Assuming CSV format: Date, Description, Amount, Type (credit/debit)
                const [date, description, amount, type] = line.split(',').map(s => s.trim());
                
                if (date && description && amount) {
                    transactions.push({
                        date: new Date(date),
                        description: description.replace(/"/g, ''),
                        amount: parseFloat(amount),
                        type: type || 'debit',
                        category: categorizeTransaction(description)
                    });
                }
            }
            
            financialData.transactions = transactions;
            resolve();
        };
        
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Categorize transactions based on description
function categorizeTransaction(description) {
    const desc = description.toLowerCase();
    
    if (desc.includes('restaurant') || desc.includes('food') || desc.includes('grocery') || 
        desc.includes('cafe') || desc.includes('dining')) {
        return 'Food & Dining';
    } else if (desc.includes('gas') || desc.includes('uber') || desc.includes('lyft') || 
               desc.includes('transit') || desc.includes('parking')) {
        return 'Transportation';
    } else if (desc.includes('movie') || desc.includes('netflix') || desc.includes('spotify') || 
               desc.includes('game') || desc.includes('entertainment')) {
        return 'Entertainment';
    } else if (desc.includes('electric') || desc.includes('water') || desc.includes('internet') || 
               desc.includes('phone') || desc.includes('utility') || desc.includes('rent')) {
        return 'Bills & Utilities';
    } else if (desc.includes('amazon') || desc.includes('store') || desc.includes('shop') || 
               desc.includes('mall')) {
        return 'Shopping';
    } else if (desc.includes('doctor') || desc.includes('hospital') || desc.includes('pharmacy') || 
               desc.includes('medical') || desc.includes('health')) {
        return 'Healthcare';
    }
    return 'Other';
}

// Process transactions and calculate totals
function processTransactions() {
    // Reset categories
    Object.keys(financialData.categories).forEach(key => {
        financialData.categories[key] = 0;
    });
    
    let totalIncome = 0;
    let totalExpenses = 0;
    
    financialData.transactions.forEach(transaction => {
        if (transaction.type === 'credit') {
            totalIncome += transaction.amount;
        } else {
            totalExpenses += transaction.amount;
            financialData.categories[transaction.category] += transaction.amount;
        }
    });
    
    financialData.monthlyIncome = totalIncome;
    financialData.monthlySpending = totalExpenses;
    financialData.totalBalance = totalIncome - totalExpenses;
    
    // Generate monthly trends
    generateMonthlyTrends();
}

// Generate monthly trends for the chart
function generateMonthlyTrends() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const trends = [];
    
    // Group transactions by month
    const monthlyData = {};
    
    financialData.transactions.forEach(transaction => {
        const month = transaction.date.toLocaleString('default', { month: 'short' });
        if (!monthlyData[month]) {
            monthlyData[month] = { income: 0, spending: 0 };
        }
        
        if (transaction.type === 'credit') {
            monthlyData[month].income += transaction.amount;
        } else {
            monthlyData[month].spending += transaction.amount;
        }
    });
    
    // Create trend data for last 6 months
    months.forEach(month => {
        trends.push({
            month: month,
            income: monthlyData[month]?.income || 0,
            spending: monthlyData[month]?.spending || 0
        });
    });
    
    financialData.monthlyTrends = trends;
}

// Update dashboard with financial data
function updateDashboard() {
    // Update summary cards
    document.querySelector('#totalBalance p').textContent = 
        `$${financialData.totalBalance.toFixed(2)}`;
    
    document.querySelector('#monthlySpending p').textContent = 
        `$${financialData.monthlySpending.toFixed(2)}`;
    
    const totalGoals = financialData.savingsGoals.reduce((sum, goal) => sum + goal.target, 0);
    document.querySelector('#savingGoals p').textContent = 
        `$${totalGoals.toFixed(2)}`;
    
    // Update all charts
    updateSpendingTrendChart();
    updateCategoryChart();
    updateSavingsChart();
    updateBudgetInsightsChart();
}

// Initialize all charts
function initializeCharts() {
    // Spending Trend Chart
    const spendingCtx = document.getElementById('spendingChart').getContext('2d');
    spendingChart = new Chart(spendingCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Income',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Spending',
                data: [],
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
    
    // Category Chart
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
                    '#9966FF', '#FF9F40', '#C9CBCF'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
    
    // Savings Chart
    const savingsCtx = document.getElementById('savingsChart').getContext('2d');
    savingsChart = new Chart(savingsCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Current',
                data: [],
                backgroundColor: '#10b981'
            }, {
                label: 'Target',
                data: [],
                backgroundColor: '#e5e7eb'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
    
    // Budget Insights Chart
    const budgetCtx = document.getElementById('budgetChart').getContext('2d');
    budgetChart = new Chart(budgetCtx, {
        type: 'bar',
        data: {
            labels: ['Income', 'Spending', 'Savings'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#10b981', '#ef4444', '#3b82f6']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Update individual charts
function updateSpendingTrendChart() {
    spendingChart.data.labels = financialData.monthlyTrends.map(t => t.month);
    spendingChart.data.datasets[0].data = financialData.monthlyTrends.map(t => t.income);
    spendingChart.data.datasets[1].data = financialData.monthlyTrends.map(t => t.spending);
    spendingChart.update();
}

function updateCategoryChart() {
    const categories = Object.keys(financialData.categories);
    const values = Object.values(financialData.categories).filter(v => v > 0);
    const labels = categories.filter((_, i) => Object.values(financialData.categories)[i] > 0);
    
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = values;
    categoryChart.update();
}

function updateSavingsChart() {
    const goalNames = financialData.savingsGoals.map(g => g.name);
    const currentAmounts = financialData.savingsGoals.map(g => g.current);
    const targetAmounts = financialData.savingsGoals.map(g => g.target);
    
    savingsChart.data.labels = goalNames;
    savingsChart.data.datasets[0].data = currentAmounts;
    savingsChart.data.datasets[1].data = targetAmounts;
    savingsChart.update();
}

function updateBudgetInsightsChart() {
    const savings = financialData.monthlyIncome - financialData.monthlySpending;
    budgetChart.data.datasets[0].data = [
        financialData.monthlyIncome,
        financialData.monthlySpending,
        savings
    ];
    budgetChart.update();
}

// Add new savings goal
function showAddGoalModal() {
    const goalName = prompt('Enter goal name (e.g., New Car):');
    if (!goalName) return;
    
    const targetAmount = parseFloat(prompt('Enter target amount:'));
    if (isNaN(targetAmount)) {
        alert('Invalid amount');
        return;
    }
    
    const deadline = prompt('Enter deadline (YYYY-MM-DD):');
    
    financialData.savingsGoals.push({
        name: goalName,
        target: targetAmount,
        current: 0,
        deadline: deadline
    });
    
    updateSavingsChart();
    alert('Goal added successfully!');
}

// Load sample data (remove in production)
// function loadSampleData() {
//     financialData.transactions = [
//         { date: new Date('2025-06-01'), description: 'Salary', amount: 5200, type: 'credit', category: 'Other' },
//         { date: new Date('2025-06-03'), description: 'Grocery Store', amount: 150, type: 'debit', category: 'Food & Dining' },
//         { date: new Date('2025-06-05'), description: 'Gas Station', amount: 60, type: 'debit', category: 'Transportation' },
//         { date: new Date('2025-06-07'), description: 'Netflix Subscription', amount: 15, type: 'debit', category: 'Entertainment' },
//         { date: new Date('2025-06-10'), description: 'Electric Bill', amount: 120, type: 'debit', category: 'Bills & Utilities' },
//         { date: new Date('2025-06-12'), description: 'Restaurant', amount: 85, type: 'debit', category: 'Food & Dining' },
//         { date: new Date('2025-06-15'), description: 'Amazon Purchase', amount: 200, type: 'debit', category: 'Shopping' },
//         { date: new Date('2025-06-18'), description: 'Doctor Visit', amount: 100, type: 'debit', category: 'Healthcare' },
//         { date: new Date('2025-06-20'), description: 'Uber Ride', amount: 25, type: 'debit', category: 'Transportation' },
//         { date: new Date('2025-06-25'), description: 'Cafe', amount: 35, type: 'debit', category: 'Food & Dining' }
//     ];
    
//     financialData.monthlyTrends = [
//         { month: 'Jan', income: 5000, spending: 3200 },
//         { month: 'Feb', income: 5100, spending: 3500 },
//         { month: 'Mar', income: 5000, spending: 3800 },
//         { month: 'Apr', income: 5200, spending: 4100 },
//         { month: 'May', income: 5200, spending: 3900 },
//         { month: 'Jun', income: 5200, spending: 3850 }
//     ];
    
//     financialData.savingsGoals = [
//         { name: 'New Car', target: 15000, current: 3500, deadline: '2026-12-31' },
//         { name: 'Vacation', target: 3000, current: 1200, deadline: '2025-12-31' }
//     ];
    
//     processTransactions();
//     updateDashboard();
// }