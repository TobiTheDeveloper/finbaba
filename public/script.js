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

// API Base URL
const API_URL = 'http://localhost:3000/api';
const USER_ID = 'user_' + Date.now(); // Generate unique user ID

// Chart instances
let spendingChart, categoryChart, savingsChart, budgetChart;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeCharts();
    checkExistingData();
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

// Check for existing data
async function checkExistingData() {
    try {
        const response = await fetch(`${API_URL}/financial-data/${USER_ID}`);
        if (response.ok) {
            const data = await response.json();
            financialData = data;
            updateDashboard();
        }
    } catch (error) {
        console.log('No existing data found');
    }
}

// File Upload Handler with Backend Integration
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show loading state
    showLoadingState();
    
    try {
        // Create FormData
        const formData = new FormData();
        formData.append('bankStatement', file);
        formData.append('userId', USER_ID);

        // Upload to backend
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        const result = await response.json();
        
        if (result.success) {
            financialData = result.data;
            updateDashboard();
            alert('✅ Bank statement processed successfully!');
        } else {
            throw new Error(result.error || 'Processing failed');
        }
        
    } catch (error) {
        console.error('Error processing file:', error);
        alert('❌ Error processing file: ' + error.message);
    } finally {
        hideLoadingState();
    }
}

// Show loading state
function showLoadingState() {
    document.querySelector('#totalBalance p').textContent = 'Loading...';
    document.querySelector('#monthlySpending p').textContent = 'Loading...';
    document.querySelectorAll('#savingGoals p')[0].textContent = 'Loading...';
}

// Hide loading state
function hideLoadingState() {
    // Dashboard will be updated with real data
}

// Update dashboard with financial data
function updateDashboard() {
    // Update summary cards
    document.querySelector('#totalBalance p').textContent = 
        `$${financialData.totalBalance.toFixed(2)}`;
    
    document.querySelector('#monthlySpending p').textContent = 
        `$${financialData.monthlySpending.toFixed(2)}`;
    
    const totalGoals = financialData.savingsGoals?.reduce((sum, goal) => sum + goal.target, 0) || 0;
    document.querySelectorAll('#savingGoals p')[0].textContent = 
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
                fill: true,
                borderWidth: 3
            }, {
                label: 'Spending',
                data: [],
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true,
                    labels: {
                        font: { size: 14 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
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
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'right',
                    labels: {
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            return label + ': $' + value.toFixed(2);
                        }
                    }
                }
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
                backgroundColor: '#10b981',
                borderRadius: 5
            }, {
                label: 'Target',
                data: [],
                backgroundColor: '#e5e7eb',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
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
                backgroundColor: ['#10b981', '#ef4444', '#3b82f6'],
                borderRadius: 5,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            }
        }
    });
}

// Update individual charts
function updateSpendingTrendChart() {
    if (!financialData.monthlyTrends || financialData.monthlyTrends.length === 0) return;
    
    spendingChart.data.labels = financialData.monthlyTrends.map(t => t.month);
    spendingChart.data.datasets[0].data = financialData.monthlyTrends.map(t => t.income);
    spendingChart.data.datasets[1].data = financialData.monthlyTrends.map(t => t.spending);
    spendingChart.update();
}

function updateCategoryChart() {
    if (!financialData.categories) return;
    
    const categories = Object.keys(financialData.categories);
    const values = Object.values(financialData.categories).filter(v => v > 0);
    const labels = categories.filter((_, i) => Object.values(financialData.categories)[i] > 0);
    
    if (labels.length === 0) return;
    
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = values;
    categoryChart.update();
}

function updateSavingsChart() {
    if (!financialData.savingsGoals || financialData.savingsGoals.length === 0) return;
    
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

// Add new savings goal with backend integration
async function showAddGoalModal() {
    const goalName = prompt('Enter goal name (e.g., New Car):');
    if (!goalName) return;
    
    const targetAmount = parseFloat(prompt('Enter target amount:'));
    if (isNaN(targetAmount)) {
        alert('Invalid amount');
        return;
    }
    
    const deadline = prompt('Enter deadline (YYYY-MM-DD):');
    if (!deadline) return;
    
    try {
        const response = await fetch(`${API_URL}/savings-goal`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: USER_ID,
                name: goalName,
                target: targetAmount,
                deadline: deadline
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (!financialData.savingsGoals) {
                financialData.savingsGoals = [];
            }
            financialData.savingsGoals.push(result.goal);
            updateSavingsChart();
            alert('✅ Goal added successfully!');
        }
    } catch (error) {
        console.error('Error adding goal:', error);
        alert('❌ Error adding goal');
    }
}