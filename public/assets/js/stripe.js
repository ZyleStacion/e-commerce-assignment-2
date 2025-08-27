// Add this to your existing script section
let stripe;
let elements;

async function initializeStripe() {
    try {
        // Get the Stripe publishable key from the server-rendered data
        const stripePublishableKey = window.STRIPE_PUBLISHABLE_KEY;
        
        if (!stripePublishableKey) {
            console.error('Stripe publishable key not found');
            return;
        }
        
        // Initialize Stripe with publishable key
        stripe = Stripe(stripePublishableKey);
        
        // Get cart total from the global CART_TOTAL variable or calculate it
        const cartTotal = window.CART_TOTAL || calculateCartTotal();
        
        // Create PaymentIntent on your server
        const response = await fetch("/create-payment-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: Math.round(cartTotal * 100) }), // convert to cents
        });
        
        const data = await response.json();
        
        if (!response.ok || data.error) {
            console.error('Error creating payment intent:', data.error);
            // Redirect to failure page if payment intent creation fails
            const errorMessage = data.error || 'Unable to initialize payment. Please try again.';
            const errorType = data.type || 'initialization_error';
            const failureUrl = `/failure?error=${encodeURIComponent(errorMessage)}&type=${errorType}`;
            window.location.href = failureUrl;
            return;
        }
        
        const { clientSecret } = data;
        
        // Create Payment Element
        elements = stripe.elements({
            clientSecret,
            appearance: {
                theme: 'stripe',
            },
        });
        
        // Create and mount the Payment Element
        const paymentElement = elements.create("payment");
        paymentElement.mount("#payment-element");
        
        // Get the submit button
        const submitButton = document.getElementById("stripe-submit-button");
        
        // Initially disable the submit button
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Enter payment details";
        }
        
        // Listen for changes in the Payment Element
        paymentElement.on('change', (event) => {
            if (submitButton) {
                if (event.complete) {
                    // Form is complete and valid
                    submitButton.disabled = false;
                    
                    // Update button text based on payment method type
                    if (event.value && event.value.type) {
                        switch (event.value.type) {
                            case 'cashapp':
                                submitButton.textContent = "Pay with Cash App";
                                break;
                            case 'card':
                                submitButton.textContent = "Pay with Card";
                                break;
                            default:
                                submitButton.textContent = "Pay with Stripe";
                        }
                    } else {
                        submitButton.textContent = "Pay with Stripe";
                    }
                } else {
                    // Form is incomplete or invalid
                    submitButton.disabled = true;
                    if (event.error) {
                        submitButton.textContent = "Fix errors above";
                    } else {
                        submitButton.textContent = "Enter payment details";
                    }
                }
            }
        });
        
        // Handle form submission
        if (submitButton) {
            // Remove any existing event listeners to prevent duplicates
            submitButton.removeEventListener("click", handleStripeSubmit);
            submitButton.addEventListener("click", handleStripeSubmit);
        }
    } catch (error) {
        console.error('Error initializing Stripe:', error);
    }
}

async function handleStripeSubmit(e) {
    e.preventDefault();
    
    if (!stripe || !elements) {
        console.error('Stripe not properly initialized');
        return;
    }
    
    // Disable the submit button to prevent multiple clicks
    const submitButton = document.getElementById("stripe-submit-button");
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "Processing...";
    
    const messageContainer = document.getElementById("payment-message");
    messageContainer.textContent = "Processing payment...";
    messageContainer.classList.remove("hidden");
    
    try {
        // First, try to submit without redirect to see if we can handle it directly
        const { error: submitError, paymentIntent: directPaymentIntent } = await stripe.confirmPayment({
            elements,
            redirect: 'if_required',
        });
        
        // If we get an error about return_url (Cash App Pay, BLIK, etc.), use redirect flow
        if (submitError && submitError.message && submitError.message.includes('return_url')) {
            console.log('Payment method requires redirect, using return_url flow');
            
            // Update message for redirect-based payment methods
            messageContainer.textContent = "Redirecting to complete payment...";
            submitButton.textContent = "Redirecting...";
            
            // Use the redirect flow for payment methods that require it
            const { error: redirectError } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/success`,
                },
            });
            
            // If there's still an error with the redirect flow, handle it
            if (redirectError) {
                console.error('Payment error with redirect:', redirectError);
                const failureUrl = `/failure?error=${encodeURIComponent(redirectError.message)}&type=${redirectError.type || 'payment_error'}`;
                window.location.href = failureUrl;
            }
            // If no error, the user will be redirected to the return_url
            return;
        }
        
        // Handle other errors from the direct confirmation
        if (submitError) {
            let errorMessage = submitError.message;
            let errorType = submitError.type || 'payment_error';
            
            console.error('Payment error:', submitError);
            
            // Redirect to failure page with error details
            const failureUrl = `/failure?error=${encodeURIComponent(errorMessage)}&type=${errorType}`;
            window.location.href = failureUrl;
            return;
        }
        
        // Check payment intent status for direct confirmations
        if (directPaymentIntent) {
            if (directPaymentIntent.status === 'succeeded') {
                // Payment succeeded - redirect to success page
                window.location.href = '/success';
            } else if (directPaymentIntent.status === 'requires_action') {
                // Handle 3D Secure or other authentication that wasn't caught above
                const { error: actionError } = await stripe.confirmPayment({
                    elements,
                    confirmParams: {
                        return_url: `${window.location.origin}/success`,
                    },
                });
                
                if (actionError) {
                    const failureUrl = `/failure?error=${encodeURIComponent(actionError.message)}&type=authentication_error`;
                    window.location.href = failureUrl;
                }
            } else if (directPaymentIntent.status === 'requires_payment_method') {
                // Payment failed - redirect to failure page
                const failureUrl = `/failure?error=${encodeURIComponent('Payment failed. Please try a different payment method.')}&type=payment_failed`;
                window.location.href = failureUrl;
            } else {
                // Other statuses (processing, canceled, etc.)
                const failureUrl = `/failure?error=${encodeURIComponent('Payment could not be completed. Status: ' + directPaymentIntent.status)}&type=payment_incomplete`;
                window.location.href = failureUrl;
            }
        } else {
            // No payment intent returned - unexpected error
            const failureUrl = `/failure?error=${encodeURIComponent('Payment processing failed. Please try again.')}&type=processing_error`;
            window.location.href = failureUrl;
        }
        
    } catch (unexpectedError) {
        // Handle unexpected errors
        console.error('Unexpected error during payment:', unexpectedError);
        const failureUrl = `/failure?error=${encodeURIComponent('An unexpected error occurred. Please try again.')}&type=unexpected_error`;
        window.location.href = failureUrl;
    }
}