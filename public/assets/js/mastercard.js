// Mastercard Gateway Hosted Checkout Implementation

let mastercardSessionId = null;
let mastercardInitialized = false;

async function initializeMastercardHostedCheckout() {
    try {
        console.log('Initializing Mastercard Hosted Checkout...');
        
        // Create a checkout session on the server
        const total = window.CART_TOTAL || 10.00;
        const response = await fetch('/api/mastercard/create-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: total,
                currency: 'USD',
                orderId: 'ORDER_' + Date.now()
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.session) {
            mastercardSessionId = data.session.id;
            console.log('Mastercard session created:', mastercardSessionId);
            
            // Configure Mastercard Checkout
            if (window.Checkout) {
                window.Checkout.configure({
                    session: {
                        id: mastercardSessionId
                    }
                });
                console.log('Mastercard Checkout configured');
                mastercardInitialized = true;
                renderMastercardButton();
                return true;
            } else {
                throw new Error('Mastercard Checkout library not loaded');
            }
        } else {
            throw new Error(data.error || 'Failed to create Mastercard session');
        }
        
    } catch (error) {
        console.error('Error initializing Mastercard Hosted Checkout:', error);
        return false;
    }
}

function renderMastercardButton() {
    const container = document.getElementById('mastercard-button-container');
    if (!container) {
        console.error('Mastercard container not found');
        return;
    }
    
    // Only render if properly initialized
    else if (!mastercardInitialized || !mastercardSessionId) {
        return;
    }
    else {
        container.innerHTML = `
            <button 
                id="mastercard-pay-btn" 
                class="btn btn-primary btn-block" 
                onclick="startMastercardPayment()"
                style="background-color: #eb001b; border-color: #eb001b; padding: 12px; font-weight: 500;">
                <i class="fa fa-credit-card"></i> Pay with Mastercard
            </button>
            <div id="mastercard-embed-target" style="margin-top: 15px; display: none;"></div>
        `;
        
        container.style.display = 'block';
        console.log('Mastercard Hosted Checkout button rendered');
    }
}

function startMastercardPayment() {
    // Check if Mastercard is properly initialized
    if (!mastercardInitialized || !mastercardSessionId) {
        console.error('Mastercard payment not ready:', { 
            initialized: mastercardInitialized, 
            sessionId: mastercardSessionId 
        });
        alert('Mastercard payment is not ready. Please refresh the page and try again.');
        return;
    }
    
    if (!window.Checkout) {
        console.error('Mastercard Checkout library not available');
        alert('Mastercard payment system is not available. Please try again later.');
        return;
    }
    
    console.log('Starting Mastercard payment with session:', mastercardSessionId);
    
    try {
        // Show embedded checkout
        const embedTarget = document.getElementById('mastercard-embed-target');
        if (embedTarget) {
            embedTarget.style.display = 'block';
            embedTarget.innerHTML = '<div style="text-align: center; padding: 20px;">Loading Mastercard payment...</div>';
            
            // Use embedded page for better user experience
            window.Checkout.showEmbeddedPage('#mastercard-embed-target');
        } else {
            console.log('Embed target not found, using payment page');
            // Fallback to payment page if embed target not found
            window.Checkout.showPaymentPage();
        }
    } catch (error) {
        console.error('Error starting Mastercard payment:', error);
        alert('Failed to start Mastercard payment. Please try again.');
    }
}

// Initialize when the script loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Mastercard Hosted Checkout script loaded');
    
    // Reset state
    mastercardSessionId = null;
    mastercardInitialized = false;
    
    // Check if Mastercard Checkout library is available
    if (window.Checkout) {
        console.log('Mastercard Checkout library available');
        initializeMastercardHostedCheckout();
    } else {
        console.log('Waiting for Mastercard Checkout library to load...');
        // Wait a bit for the library to load
        setTimeout(() => {
            if (window.Checkout) {
                console.log('Mastercard Checkout library loaded (delayed)');
                initializeMastercardHostedCheckout();
            } else {
                console.error('Mastercard Checkout library not available');
            }
        }, 2000);
    }
});