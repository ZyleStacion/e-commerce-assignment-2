// Mastercard Gateway Hosted Checkout Implementation
// This replaces the SRC implementation with Gateway Hosted Checkout (available in Vietnam)

let mastercardSessionId = null;

// Callback functions for Mastercard Hosted Checkout
function mastercardErrorCallback(error) {
    console.error('Mastercard payment error:', error);
    alert('Payment failed. Please try again or choose a different payment method.');
}

function mastercardCancelCallback() {
    console.log('Mastercard payment cancelled by user');
    // User can try again or choose different payment method
}

function mastercardCompleteCallback(resultIndicator) {
    console.log('Mastercard payment completed:', resultIndicator);
    // Process the payment result on server
    processMastercardPaymentResult(resultIndicator);
}

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
        
        if (data.success && data.sessionId) {
            mastercardSessionId = data.sessionId;
            console.log('Mastercard session created:', mastercardSessionId);
            
            // Configure Mastercard Checkout
            if (window.Checkout) {
                window.Checkout.configure({
                    session: {
                        id: mastercardSessionId
                    }
                });
                console.log('Mastercard Checkout configured');
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
        showMastercardError();
        return false;
    }
}

function renderMastercardButton() {
    const container = document.getElementById('mastercard-button-container');
    if (!container) {
        console.error('Mastercard container not found');
        return;
    }
    
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
    
    console.log('Mastercard Hosted Checkout button rendered');
}

function startMastercardPayment() {
    if (!mastercardSessionId) {
        alert('Mastercard payment is not ready. Please try again.');
        return;
    }
    
    if (!window.Checkout) {
        alert('Mastercard payment system is not available. Please try again later.');
        return;
    }
    
    console.log('Starting Mastercard payment...');
    
    // Show embedded checkout
    const embedTarget = document.getElementById('mastercard-embed-target');
    if (embedTarget) {
        embedTarget.style.display = 'block';
        embedTarget.innerHTML = '<div style="text-align: center; padding: 20px;">Loading Mastercard payment...</div>';
        
        try {
            // Use embedded page for better user experience
            window.Checkout.showEmbeddedPage('#mastercard-embed-target');
        } catch (error) {
            console.error('Error showing Mastercard embedded page:', error);
            // Fallback to payment page
            window.Checkout.showPaymentPage();
        }
    } else {
        // Fallback to payment page if embed target not found
        window.Checkout.showPaymentPage();
    }
}

async function processMastercardPaymentResult(resultIndicator) {
    try {
        console.log('Processing Mastercard payment result:', resultIndicator);
        
        const response = await fetch('/api/mastercard/process-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                resultIndicator: resultIndicator,
                sessionId: mastercardSessionId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('Mastercard payment processed successfully');
            window.location.href = '/success';
        } else {
            console.error('Mastercard payment processing failed:', data.error);
            alert('Payment processing failed: ' + (data.error || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error processing Mastercard payment result:', error);
        alert('Payment processing failed. Please contact support.');
    }
}

function showMastercardError() {
    const container = document.getElementById('mastercard-button-container');
    if (container) {
        container.innerHTML = `
            <div style="padding: 10px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; color: #721c24;">
                <strong>Mastercard Unavailable</strong><br>
                <small>Please use PayPal or Google Pay</small>
            </div>
        `;
    }
}

// Initialize when the script loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Mastercard Hosted Checkout script loaded');
    
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
                showMastercardError();
            }
        }, 2000);
    }
});