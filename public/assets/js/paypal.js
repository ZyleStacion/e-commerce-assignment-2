//=============================================================================
// PayPal Integration for Checkout
//=============================================================================

let paypalButtonsInstance;

// Initialize PayPal Buttons
function initializePayPalButtons() {
    if (window.paypal && window.paypal.Buttons) {
        // Get cart total from global variable (set in checkout page)
        const cartTotal = typeof CART_TOTAL !== 'undefined' ? CART_TOTAL : 0;
        
        paypalButtonsInstance = window.paypal.Buttons({
            style: {
                layout: 'horizontal',
                color: 'blue',
                shape: 'rect',
                label: 'paypal'
            },
            
            createOrder: function(data, actions) {
                return actions.order.create({
                    purchase_units: [{
                        amount: {
                            value: cartTotal.toFixed(2)
                        }
                    }]
                });
            },
            
            onApprove: function(data, actions) {
                return actions.order.capture().then(function(details) {
                    console.log('Transaction completed by ' + details.payer.name.given_name);
                    window.location.href = '/success';
                });
            },
            
            onError: function(err) {
                console.error('PayPal Buttons error:', err);
                alert('Payment failed. Please try again.');
            }
            
        }).render('#paypal-button-container');
    } else {
        console.log('PayPal SDK not loaded or Buttons not available');
    }
}

// Auto-initialize when DOM is loaded (if this script is loaded after DOM)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePayPalButtons);
} else {
    // DOM is already loaded
    initializePayPalButtons();
}
