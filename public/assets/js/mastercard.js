async function initializeMastercardCheckoutServices() {
    try {
        // Get the DPA ID from the environment variable (passed from server)
        const srcDpaId = window.mastercardDpaId; // This will be passed from your EJS template
        
        const params = {
            srcDpaId: srcDpaId, // Your DPA Identifier from .env
            dpaData: {
                dpaName: "Alice's Bakeshop" // Replace with your actual store name
            },
            dpaTransactionOptions: {
                dpaLocale: "en_US"
            },
            cardBrands: ["mastercard"] // Only Mastercard for now
        };

        const mcCheckoutService = new MastercardCheckoutServices();
        const result = await mcCheckoutService.init(params);
        
        console.log('Mastercard checkout services initialized:', result);
        
        // Store the service globally for later use
        window.mcCheckoutService = mcCheckoutService;
        
        return result;
    } catch (error) {
        console.error('Error initializing Mastercard checkout services:', error);
        throw error;
    }
}

function renderMastercardButton() {
    const container = document.getElementById('mastercard-button-container');
    if (!container) {
        console.error('Mastercard container not found');
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create SRC button element
    const srcButton = document.createElement('src-button');
    srcButton.setAttribute('locale', 'en_US');
    srcButton.setAttribute('card-brands', '["mastercard"]');
    srcButton.style.display = 'block';
    
    // Add click event listener
    srcButton.addEventListener('click', handleMastercardPayment);
    
    container.appendChild(srcButton);
    console.log('Mastercard SRC button rendered');
}

async function handleMastercardPayment(event) {
    console.log('Mastercard payment button clicked');
    event.preventDefault();
    
    try {
        // Get cart total
        const total = window.CART_TOTAL || 10.00;
        
        console.log('Processing Mastercard payment for amount:', total);
        
        // Use Mastercard checkout services for payment processing
        if (window.mcCheckoutService) {
            // TODO: Implement actual Mastercard payment flow
            // For now, simulate the payment process
            alert(`Processing Mastercard payment for $${total.toFixed(2)}`);
            
            setTimeout(() => {
                alert('Payment successful!');
                window.location.href = '/';
            }, 1000);
        } else {
            console.error('Mastercard checkout service not available');
            alert('Mastercard payment service is not available. Please try again.');
        }
        
    } catch (error) {
        console.error('Payment failed:', error);
        alert('Payment failed. Please try again.');
    }
}

// Initialize when the script loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Mastercard.js DOM loaded');
    console.log('MastercardCheckoutServices available:', typeof window.MastercardCheckoutServices);
    console.log('mastercardDpaId:', window.mastercardDpaId);
    
    if (window.MastercardCheckoutServices) {
        initializeMastercardCheckoutServices();
    } else {
        console.error('MastercardCheckoutServices not available');
    }
});