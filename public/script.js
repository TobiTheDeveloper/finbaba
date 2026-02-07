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

// API Base URL - Change this if accessing from different port
const API_URL = 'http://localhost:3000/api';

// Get authentication token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Get current user
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Check if user is authenticated
function isAuthenticated() {
    return !!getAuthToken();
}

// Logout user
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Update header with user info
function updateHeader() {
    const user = getCurrentUser();
    
    if (user) {
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('guestActions').style.display = 'none';
        document.getElementById('userName').textContent = user.name || user.email;
        
        const badge = document.getElementById('subscriptionBadge');
        badge.textContent = user.subscription?.tier || 'Free';
        badge.className = 'subscription-badge ' + (user.subscription?.tier || 'free');
        
        // Show upgrade banner for free users
        if (user.subscription?.tier === 'free') {
            document.getElementById('upgradeBanner').style.display = 'block';
        }
    } else {
        document.getElementById('userInfo').style.display = 'none';
        document.getElementById('guestActions').style.display = 'flex';
    }
}

// Test backend connection on load
async function testBackendConnection() {
    try {
        const response = await fetch(`${API_URL}/health`);
        if (response.ok) {
            console.log('✅ Backend connected successfully');
        } else {
            console.error('❌ Backend responded with error:', response.status);
        }
    } catch (error) {
        console.error('❌ Cannot connect to backend:', error.message);
        // Don't show alert in production
    }
}

// Chart instances
let spendingChart, categoryChart, savingsChart, budgetChart;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    updateHeader();
    initializeEventListeners();
    initializeCharts();
    
    if (isAuthenticated()) {
        checkExistingData();
        loadAffiliateRecommendations();
        loadAIRecommendations();
    } else {
        // Show guest message
        console.log('Guest mode - please login to save data');
    }
});

// Event Listeners
function initializeEventListeners() {
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const addGoalBtn = document.getElementById('addGoalBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const accountBtn = document.getElementById('accountBtn');

    uploadBtn.addEventListener('click', () => {
        if (!isAuthenticated()) {
            if (confirm('Please login to upload bank statements. Go to login page?')) {
                window.location.href = 'login.html';
            }
            return;
        }
        fileInput.click();
    });
    
    fileInput.addEventListener('change', handleFileUpload);
    addGoalBtn.addEventListener('click', showAddGoalModal);
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    if (accountBtn) {
        accountBtn.addEventListener('click', () => {
            window.location.href = 'pricing.html';
        });
    }
}

// Check for existing data
async function checkExistingData() {
    if (!isAuthenticated()) return;
    
    try {
        const response = await fetch(`${API_URL}/financial-data`, {
            headers: {
                'Authorization': 'Bearer ' + getAuthToken()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            financialData = data;
            updateDashboard();
        } else if (response.status === 401) {
            // Token expired
            logout();
        }
    } catch (error) {
        console.log('No existing data found');
    }
}

// File Upload Handler with Backend Integration
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!isAuthenticated()) {
        alert('Please login to upload bank statements');
        window.location.href = 'login.html';
        return;
    }

    // Show loading state
    showLoadingState();
    
    try {
        // Create FormData
        const formData = new FormData();
        formData.append('bankStatement', file);

        // Upload to backend
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + getAuthToken()
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            
            // Handle usage limit errors
            if (response.status === 429) {
                if (confirm(error.message + '\n\nWould you like to upgrade now?')) {
                    window.location.href = 'pricing.html';
                }
                throw new Error(error.message);
            }
            
            throw new Error(error.error || 'Upload failed');
        }

        const result = await response.json();
        
        if (result.success) {
            financialData = result.data;
            updateDashboard();
            
            // Display affiliate recommendations
            if (result.data.affiliateRecommendations) {
                displayAffiliateRecommendations(result.data.affiliateRecommendations);
            }
            
            // Display AI recommendations for premium users
            if (result.data.aiRecommendations) {
                displayAIRecommendations(result.data.aiRecommendations);
            }
            
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
// Load and display affiliate recommendations
async function loadAffiliateRecommendations() {
    if (!isAuthenticated()) return;
    
    try {
        const response = await fetch(`${API_URL}/affiliate-recommendations`, {
            headers: {
                'Authorization': 'Bearer ' + getAuthToken()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.recommendations && data.recommendations.length > 0) {
                displayAffiliateRecommendations(data.recommendations);
            }
        }
    } catch (error) {
        console.error('Error loading affiliate recommendations:', error);
    }
}

// Display affiliate recommendations
function displayAffiliateRecommendations(recommendations) {
    const container = document.getElementById('affiliateList');
    if (!container || !recommendations || recommendations.length === 0) return;
    
    container.innerHTML = recommendations.map(rec => `
        <div class="affiliate-card">
            <div class="affiliate-card-header">
                <span class="affiliate-icon">${rec.icon}</span>
                <div>
                    <h3>${rec.product}</h3>
                    <div class="affiliate-partner">${rec.partner}</div>
                </div>
            </div>
            <p>${rec.description}</p>
            <ul class="affiliate-benefits">
                ${rec.benefits.map(b => `<li>${b}</li>`).join('')}
            </ul>
            <div class="estimated-value">
                Potential Value: $${rec.estimatedValue.toFixed(2)}/year
            </div>
            <a href="${rec.affiliateLink}" 
               class="affiliate-cta" 
               onclick="trackAffiliateClick('${rec.id}', event)"
               target="_blank">
                ${rec.ctaText}
            </a>
        </div>
    `).join('');
}

// Track affiliate click
async function trackAffiliateClick(partnerId, event) {
    if (!isAuthenticated()) return;
    
    try {
        await fetch(`${API_URL}/affiliate-click`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getAuthToken()
            },
            body: JSON.stringify({
                partnerId: partnerId,
                recommendationId: Date.now()
            })
        });
    } catch (error) {
        console.error('Error tracking click:', error);
    }
}

// Load and display AI recommendations (Premium feature)
async function loadAIRecommendations() {
    if (!isAuthenticated()) return;
    
    const user = getCurrentUser();
    if (!user || (user.subscription?.tier !== 'premium' && user.subscription?.tier !== 'business')) {
        return; // AI recommendations only for premium users
    }
    
    try {
        const response = await fetch(`${API_URL}/ai-recommendations`, {
            headers: {
                'Authorization': 'Bearer ' + getAuthToken()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.recommendations && data.recommendations.length > 0) {
                displayAIRecommendations(data.recommendations);
            }
        }
    } catch (error) {
        console.error('Error loading AI recommendations:', error);
    }
}

// Display AI recommendations
function displayAIRecommendations(recommendations) {
    const container = document.getElementById('recommendationsList');
    const section = document.getElementById('aiRecommendations');
    
    if (!container || !section || !recommendations || recommendations.length === 0) return;
    
    section.style.display = 'block';
    
    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-card ${rec.priority}-priority">
            <div class="recommendation-header">
                <h3>${rec.title}</h3>
                <span class="priority-badge ${rec.priority}">${rec.priority}</span>
            </div>
            <p class="description">${rec.description}</p>
            <p class="action">${rec.action}</p>
            ${rec.potentialSavings > 0 ? `
                <div class="potential-savings">
                    Potential Annual Savings: $${rec.potentialSavings.toFixed(2)}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Export data (Premium feature)
async function exportData(format) {
    if (!isAuthenticated()) {
        alert('Please login to export data');
        return;
    }
    
    const user = getCurrentUser();
    if (user.subscription?.tier === 'free') {
        if (confirm('Data export requires Pro subscription or higher. Upgrade now?')) {
            window.location.href = 'pricing.html';
        }
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/export/${format}`, {
            headers: {
                'Authorization': 'Bearer ' + getAuthToken()
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `finbaba-export.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            const error = await response.json();
            alert(error.message || 'Export failed');
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('Export failed');
    }
}
