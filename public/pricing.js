// Pricing page interactivity

document.addEventListener('DOMContentLoaded', () => {
    const billingSwitch = document.getElementById('billingSwitch');
    const priceElements = document.querySelectorAll('.price .amount');
    
    // Toggle between monthly and yearly pricing
    billingSwitch.addEventListener('change', (e) => {
        const isYearly = e.target.checked;
        
        priceElements.forEach(element => {
            const monthly = element.getAttribute('data-monthly');
            const yearly = element.getAttribute('data-yearly');
            
            if (monthly && yearly) {
                if (isYearly) {
                    const yearlyMonthly = (parseFloat(yearly) / 12).toFixed(2);
                    element.textContent = `$${yearlyMonthly}`;
                    element.parentElement.querySelector('.period').textContent = '/month (billed yearly)';
                } else {
                    element.textContent = `$${monthly}`;
                    element.parentElement.querySelector('.period').textContent = '/month';
                }
            }
        });
    });
});

// Handle plan selection
function selectPlan(planId) {
    const isYearly = document.getElementById('billingSwitch').checked;
    const billingPeriod = isYearly ? 'yearly' : 'monthly';
    
    // Store selection in localStorage
    localStorage.setItem('selectedPlan', planId);
    localStorage.setItem('billingPeriod', billingPeriod);
    
    // Redirect to signup/checkout
    if (planId === 'business') {
        // Business plan goes to contact sales
        window.location.href = `mailto:sales@finbaba.com?subject=Business Plan Inquiry`;
    } else {
        // Other plans go to checkout
        window.location.href = `checkout.html?plan=${planId}&billing=${billingPeriod}`;
    }
}

// Login button handler
document.getElementById('loginBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'login.html';
});

// Signup button handler
document.getElementById('signupBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'signup.html';
});
