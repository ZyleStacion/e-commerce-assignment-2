import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/**
 *  PayPal backend dependencies 
 * */
import {
    CheckoutPaymentIntent,
    Client,
    Environment,
    LogLevel,
    OrdersController,
} from "@paypal/paypal-server-sdk";
import bodyParser from "body-parser";
import dotenv from 'dotenv';

// Configure environment variables
dotenv.config();

// Paypal
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

// Stripe
const stripeId = process.env.STRIPE_PK;
const stripeSecret = process.env.STRIPE_SECRET;

// Coinremitter
const coinremitterWalletKey = process.env.COINREMITTER_WALLET_TEST;
const coinremitterPassword = process.env.COINREMITTER_WALLET_PASS;
const coinremitterPublicAddress = process.env.COINREMITTER_PUBLIC_ADDRESS;

// Store crypto payment data in memory (use database in production)
global.cryptoPayments = {};

// Set view engine
app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));

// Configure assets
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Middleware
app.use(express.json());

// Store cart data in memory
let storedCartData = [];

// PayPal Backend
const client = new Client({
  ClientCredentialsAuthCredentials: {
    oAuthClientId: clientId,
    oAuthClientSecret: clientSecret
  },
  timeout: 0,
  environment: Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true },
  }
})

const ordersController = new OrdersController(client);

/**
 * PayPal Order Creation
 */
const createOrder = async (cartData) => {
  // Calculate total from cart items
  const total = cartData.reduce((sum, item) => {
    return sum + (item.quantity * parseFloat(item.price));
  }, 0);

  const collect = {
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          amount: {
            currencyCode: "USD",
            value: total.toFixed(2),
            breakdown: {
              itemTotal: {
                currencyCode: "USD",
                value: total.toFixed(2)
              }
            }
          },
          items: cartData.map(item => ({
            name: item.name,
            description: item.description || item.name,
            unitAmount: {
              currencyCode: "USD",
              value: parseFloat(item.price).toFixed(2)
            },
            quantity: item.quantity.toString()
          }))
        }
      ]
    }
  };

  try {
    const { body, ...httpResponse } = await ordersController.ordersCreate(collect);
    return {
      jsonResponse: JSON.parse(body),
      httpStatusCode: httpResponse.statusCode
    };
  } catch (error) {
    console.error("Failed to create order:", error);
    throw error;
  }
};

// API endpoint to create PayPal order
app.post('/api/orders', async (req, res) => {
  try {
    const { jsonResponse, httpStatusCode } = await createOrder(storedCartData);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

// Homepage
app.get('/', (req, res) => {
  res.render('index');
})

// Cart route (also grab items from the cart)
app.get('/cart', (req, res) => {
  // Calculate individual item totals for cart page too
  const cartWithTotals = storedCartData.map(item => {
    const itemTotal = item.quantity * parseFloat(item.price);
    return {
      ...item,
      itemTotal: itemTotal
    };
  });
  
  res.render('cart', { shoppingCart: cartWithTotals });
})

// Checkout route
app.get('/checkout', (req, res) => {
  // Calculate individual item totals and overall total
  const cartWithTotals = storedCartData.map(item => {
    const itemTotal = item.quantity * parseFloat(item.price);
    return {
      ...item,
      itemTotal: itemTotal
    };
  });
  
  const total = cartWithTotals.reduce((sum, item) => {
    return sum + item.itemTotal;
  }, 0);
  console.log("Total:", total);

  res.render('checkout', { 
    shoppingCart: cartWithTotals,
    total: total,
    paypalClientId: clientId,
    stripePublishableKey: stripeId
  });
})

// Successful payment route
app.get('/success', async (req, res) => {
  const { payment_intent, payment_intent_client_secret } = req.query;
  
  // If coming from Stripe redirect, verify the payment status
  if (payment_intent) {
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = Stripe(process.env.STRIPE_SECRET);
      
      // Retrieve the payment intent to check its status
      const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);
      
      if (paymentIntent.status !== 'succeeded') {
        // Payment didn't succeed, redirect to failure
        const errorMessage = `Payment ${paymentIntent.status}. Please try again.`;
        return res.redirect(`/failure?error=${encodeURIComponent(errorMessage)}&type=payment_status_error`);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      return res.redirect(`/failure?error=${encodeURIComponent('Unable to verify payment status.')}&type=verification_error`);
    }
  }
  
  // Clear the cart after successful payment
  const orderDetails = {
    items: storedCartData,
    total: storedCartData.reduce((sum, item) => sum + (item.quantity * parseFloat(item.price)), 0)
  };
  
  // Clear the cart
  storedCartData = [];
  
  res.render('success', { orderDetails: orderDetails });
});

// Failed payment route
app.get('/failure', (req, res) => {
  const errorMessage = req.query.error || 'Payment failed. Please try again.';
  const errorType = req.query.type || 'payment_error';
  
  res.render('failure', { 
    errorMessage: errorMessage,
    errorType: errorType,
    cartItems: storedCartData,
    total: storedCartData.reduce((sum, item) => sum + (item.quantity * parseFloat(item.price)), 0)
  });
});

// API endpoint to capture PayPal order
app.post('/api/orders/:orderID/capture', async (req, res) => {
  try {
    const { orderID } = req.params;
    
    const collect = {
      id: orderID,
      body: {}
    };

    const { body, ...httpResponse } = await ordersController.ordersCapture(collect);
    const jsonResponse = JSON.parse(body);
    
    res.status(httpResponse.statusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to capture order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

// Send cart data to third-party payment APIs
app.post('/api/cart', (req, res) => {
  const cartData = req.body;
  console.log("Cart data: ", cartData);
  
  // Store the cart data
  storedCartData = cartData;

  res.json({ success:true, message: 'Cart data received successfully' })
})

app.post('/create-payment-intent', async (req, res) => {
    const { amount } = req.body;
    
    // Validate amount
    if (!amount || amount <= 0) {
        return res.status(400).json({ 
            error: 'Invalid amount. Amount must be greater than 0.' 
        });
    }
    
    try {
        // Import Stripe dynamically or add it as a top-level import
        const Stripe = (await import('stripe')).default;
        const stripe = Stripe(process.env.STRIPE_SECRET);
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount), // Ensure amount is an integer
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                // Add metadata for tracking
                source: 'ecommerce_checkout',
                timestamp: new Date().toISOString()
            }
        });
        
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (e) {
        console.error('Error creating payment intent:', e);
        
        // Return appropriate error message based on error type
        let errorMessage = 'Unable to process payment. Please try again.';
        
        if (e.type === 'StripeCardError') {
            errorMessage = 'Your card was declined. Please try a different payment method.';
        } else if (e.type === 'StripeInvalidRequestError') {
            errorMessage = 'Invalid payment request. Please check your information.';
        } else if (e.type === 'StripeAPIError') {
            errorMessage = 'Payment service temporarily unavailable. Please try again later.';
        }
        
        res.status(400).json({ 
            error: errorMessage,
            type: e.type || 'payment_error'
        });
    }
});

// ===== COINREMITTER CRYPTOCURRENCY PAYMENT SYSTEM WITH REAL VERIFICATION =====

// Check Coinremitter availability
app.get('/api/coinremitter/check-availability', (req, res) => {
    try {
        // Check if credentials are configured
        if (!coinremitterWalletKey || !coinremitterPassword || !coinremitterPublicAddress) {
            return res.json({ 
                success: false, 
                error: 'Coinremitter credentials not fully configured' 
            });
        }

        const availableCryptos = ['BTC', 'ETH', 'LTC', 'DOGE'];
        
        res.json({ 
            success: true, 
            availableCryptos: availableCryptos,
            message: 'Coinremitter cryptocurrency payments available'
        });
    } catch (error) {
        console.error('Error checking Coinremitter availability:', error);
        res.json({ 
            success: false, 
            error: 'Service unavailable' 
        });
    }
});

// Create cryptocurrency invoice with real verification
app.post('/api/coinremitter/create-invoice', async (req, res) => {
    try {
        const { amount, currency, crypto, orderId } = req.body;
        
        // Validate input
        if (!amount || !crypto || amount <= 0) {
            return res.json({ 
                success: false, 
                error: 'Invalid amount or cryptocurrency' 
            });
        }

        const supportedCryptos = ['BTC', 'ETH', 'LTC', 'DOGE'];
        if (!supportedCryptos.includes(crypto.toUpperCase())) {
            return res.json({ 
                success: false, 
                error: `Cryptocurrency ${crypto} not supported` 
            });
        }

        console.log(`Creating ${crypto} invoice for $${amount}`);

        const invoiceId = `INV_${Date.now()}_${crypto}`;
        const cryptoAmount = await convertUSDToCrypto(amount, crypto);
        
        // Use environment variable for the public address
        const paymentAddress = coinremitterPublicAddress || generateTestAddress(crypto);
        
        // Create invoice with verification tracking
        const invoice = {
            invoice_id: invoiceId,
            order_id: orderId,
            total_amount: cryptoAmount,
            crypto_currency: crypto,
            fiat_amount: amount,
            fiat_currency: currency || 'USD',
            address: paymentAddress,
            qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${crypto}:${paymentAddress}?amount=${cryptoAmount}`,
            expire_time: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
            status: 'waiting',
            created_at: new Date().toISOString(),
            confirmations_required: getCryptoConfirmations(crypto),
            network: getCryptoNetwork(crypto)
        };

        // Store payment data for verification
        global.cryptoPayments[invoiceId] = {
            ...invoice,
            verification_attempts: 0,
            last_verified: null,
            payment_verified: false,
            failure_reason: null
        };

        console.log(`Created ${crypto} invoice:`, invoiceId);
        res.json({ success: true, invoice: invoice });

    } catch (error) {
        console.error('Error creating Coinremitter invoice:', error);
        res.json({ 
            success: false, 
            error: 'Failed to create cryptocurrency invoice' 
        });
    }
});

// Enhanced payment verification using Coinremitter API
app.get('/api/coinremitter/payment-status/:invoiceId', async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const payment = global.cryptoPayments[invoiceId];
        
        if (!payment) {
            return res.json({ 
                success: false, 
                error: 'Payment not found' 
            });
        }

        // Check if payment expired
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime > payment.expire_time) {
            payment.status = 'expired';
            payment.failure_reason = 'Payment window expired';
            return res.json({ 
                success: true, 
                status: 'expired',
                failure_reason: payment.failure_reason,
                message: 'Payment has expired'
            });
        }

        // Increment verification attempts
        payment.verification_attempts += 1;
        payment.last_verified = new Date().toISOString();

        // Use Coinremitter API to check for transactions
        const verificationResult = await verifyPaymentWithCoinremitter(payment);
        
        // Update payment status based on verification
        if (verificationResult.success) {
            payment.status = verificationResult.status;
            payment.payment_verified = verificationResult.verified;
            payment.transaction_hash = verificationResult.transaction_hash;
            payment.confirmations = verificationResult.confirmations;
            
            if (verificationResult.verified) {
                payment.status = 'confirmed';
                console.log(`✅ Payment PASSED for ${invoiceId}: ${verificationResult.transaction_hash}`);
            }
        } else {
            payment.failure_reason = verificationResult.error;
            console.log(`❌ Payment FAILED for ${invoiceId}: ${verificationResult.error}`);
        }

        res.json({ 
            success: true, 
            status: payment.status,
            payment_verified: payment.payment_verified,
            confirmations: payment.confirmations || 0,
            confirmations_required: payment.confirmations_required,
            transactionHash: payment.transaction_hash,
            crypto: payment.crypto_currency,
            network: payment.network,
            verification_attempts: payment.verification_attempts,
            last_verified: payment.last_verified,
            failure_reason: payment.failure_reason
        });

    } catch (error) {
        console.error('Error checking payment status:', error);
        res.json({ 
            success: false, 
            error: 'Failed to verify payment status' 
        });
    }
});

// Manual transaction verification endpoint
app.post('/api/coinremitter/verify-transaction', async (req, res) => {
    try {
        const { invoiceId, transactionHash } = req.body;
        
        if (!invoiceId || !transactionHash) {
            return res.json({ 
                success: false, 
                error: 'Invoice ID and transaction hash required' 
            });
        }

        const payment = global.cryptoPayments[invoiceId];
        if (!payment) {
            return res.json({ 
                success: false, 
                error: 'Payment not found' 
            });
        }

        console.log(`🔍 Manual verification of transaction ${transactionHash} for invoice ${invoiceId}`);

        // Verify transaction using Coinremitter API
        const verificationResult = await verifySpecificTransaction(transactionHash, payment);
        
        if (verificationResult.success && verificationResult.verified) {
            payment.status = 'confirmed';
            payment.payment_verified = true;
            payment.transaction_hash = transactionHash;
            payment.confirmations = verificationResult.confirmations;
            
            console.log(`✅ Manual verification PASSED for ${invoiceId}`);
            
            res.json({ 
                success: true, 
                verified: true,
                status: 'confirmed',
                confirmations: verificationResult.confirmations,
                message: 'Transaction verified successfully!'
            });
        } else {
            payment.failure_reason = verificationResult.error || 'Transaction verification failed';
            
            console.log(`❌ Manual verification FAILED for ${invoiceId}: ${payment.failure_reason}`);
            
            res.json({ 
                success: true, 
                verified: false,
                error: payment.failure_reason,
                message: 'Transaction could not be verified'
            });
        }

    } catch (error) {
        console.error('Error in manual verification:', error);
        res.json({ 
            success: false, 
            error: 'Transaction verification failed' 
        });
    }
});

// ===== COINREMITTER API VERIFICATION FUNCTIONS =====

async function verifyPaymentWithCoinremitter(payment) {
    try {
        console.log(`🔍 Verifying payment for address: ${payment.address}`);
        
        // Simulate Coinremitter API call: wallet.getTransactionByAddress()
        const param = {
            address: payment.address
        };
        
        // In production, you would use the actual Coinremitter SDK:
        // const transaction = await wallet.getTransactionByAddress(param);
        
        // For now, simulate the API response
        const mockApiResponse = await simulateCoinremitterAPI(param, payment);
        
        if (mockApiResponse.success && mockApiResponse.data && mockApiResponse.data.length > 0) {
            // Find transactions matching our payment amount
            const validTransaction = mockApiResponse.data.find(tx => 
                parseFloat(tx.amount) >= payment.total_amount && 
                tx.confirmations >= payment.confirmations_required
            );
            
            if (validTransaction) {
                console.log(`✅ PASS: Valid transaction found - ${validTransaction.txid}`);
                return {
                    success: true,
                    verified: true,
                    status: 'confirmed',
                    transaction_hash: validTransaction.txid,
                    confirmations: validTransaction.confirmations,
                    amount_received: validTransaction.amount
                };
            } else {
                console.log(`❌ FAIL: No valid transaction found for required amount ${payment.total_amount}`);
                return {
                    success: true,
                    verified: false,
                    status: 'waiting',
                    error: `No valid transaction found for ${payment.total_amount} ${payment.crypto_currency}`
                };
            }
        } else {
            console.log(`❌ FAIL: No transactions found for address ${payment.address}`);
            return {
                success: true,
                verified: false,
                status: 'waiting',
                error: 'No transactions found for this address'
            };
        }
        
    } catch (error) {
        console.error('❌ FAIL: Coinremitter API error:', error);
        return {
            success: false,
            verified: false,
            error: 'Payment verification service unavailable'
        };
    }
}

async function verifySpecificTransaction(transactionHash, payment) {
    try {
        console.log(`🔍 Verifying specific transaction: ${transactionHash}`);
        
        // Validate transaction hash format
        if (!validateTransactionHash(transactionHash, payment.crypto_currency)) {
            return {
                success: false,
                verified: false,
                error: 'Invalid transaction hash format'
            };
        }
        
        // Simulate checking the specific transaction on blockchain
        const mockTransactionData = await simulateTransactionLookup(transactionHash, payment);
        
        if (mockTransactionData.found) {
            if (mockTransactionData.amount >= payment.total_amount) {
                console.log(`✅ PASS: Transaction amount ${mockTransactionData.amount} meets requirement ${payment.total_amount}`);
                return {
                    success: true,
                    verified: true,
                    confirmations: mockTransactionData.confirmations,
                    amount: mockTransactionData.amount
                };
            } else {
                console.log(`❌ FAIL: Transaction amount ${mockTransactionData.amount} insufficient (required: ${payment.total_amount})`);
                return {
                    success: false,
                    verified: false,
                    error: `Insufficient amount: received ${mockTransactionData.amount}, required ${payment.total_amount}`
                };
            }
        } else {
            console.log(`❌ FAIL: Transaction ${transactionHash} not found on blockchain`);
            return {
                success: false,
                verified: false,
                error: 'Transaction not found on blockchain'
            };
        }
        
    } catch (error) {
        console.error('❌ FAIL: Transaction verification error:', error);
        return {
            success: false,
            verified: false,
            error: 'Transaction verification failed'
        };
    }
}

// ===== SIMULATION FUNCTIONS (Replace with real Coinremitter API calls) =====

async function simulateCoinremitterAPI(param, payment) {
    // Simulate the Coinremitter getTransactionByAddress API response
    // In production, replace this with actual Coinremitter SDK call
    
    console.log(`Simulating Coinremitter API call for address: ${param.address}`);
    
    // Simulate random success/failure for demonstration
    const simulatePayment = Math.random() > 0.3; // 70% chance of payment
    
    if (simulatePayment) {
        // Simulate 2-3 minutes delay before payment appears
        const timeSinceCreation = Date.now() - new Date(payment.created_at).getTime();
        if (timeSinceCreation < 120000) { // Less than 2 minutes
            return {
                success: true,
                data: [] // No transactions yet
            };
        }
        
        // Simulate transaction found
        return {
            success: true,
            data: [
                {
                    txid: generateMockTransactionHash(payment.crypto_currency),
                    amount: payment.total_amount,
                    confirmations: 6,
                    time: Math.floor(Date.now() / 1000),
                    address: payment.address
                }
            ]
        };
    } else {
        return {
            success: true,
            data: [] // No transactions found
        };
    }
}

async function simulateTransactionLookup(transactionHash, payment) {
    console.log(`Simulating blockchain lookup for: ${transactionHash}`);
    
    // Simulate transaction found with matching amount
    const isValidHash = validateTransactionHash(transactionHash, payment.crypto_currency);
    
    if (isValidHash) {
        return {
            found: true,
            amount: payment.total_amount,
            confirmations: 6,
            timestamp: Date.now()
        };
    } else {
        return {
            found: false
        };
    }
}

// ===== HELPER FUNCTIONS =====

async function convertUSDToCrypto(usdAmount, crypto) {
    const mockRates = {
        'BTC': 45000,
        'ETH': 3000,
        'LTC': 100,
        'DOGE': 0.10
    };
    
    const rate = mockRates[crypto.toUpperCase()] || 1;
    return parseFloat((usdAmount / rate).toFixed(8));
}

function generateTestAddress(crypto) {
    const prefixes = {
        'BTC': '1',
        'ETH': '0x',
        'LTC': 'L',
        'DOGE': 'D'
    };
    
    const prefix = prefixes[crypto.toUpperCase()] || '1';
    
    if (crypto.toUpperCase() === 'ETH') {
        return '0x' + Math.random().toString(16).substr(2, 40).toUpperCase();
    } else {
        const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let address = prefix;
        for (let i = 0; i < 33; i++) {
            address += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return address;
    }
}

function getCryptoConfirmations(crypto) {
    const confirmations = {
        'BTC': 6,
        'ETH': 12,
        'LTC': 6,
        'DOGE': 6
    };
    return confirmations[crypto.toUpperCase()] || 6;
}

function getCryptoNetwork(crypto) {
    const networks = {
        'BTC': 'Bitcoin Mainnet',
        'ETH': 'Ethereum Mainnet',
        'LTC': 'Litecoin Mainnet',
        'DOGE': 'Dogecoin Mainnet'
    };
    return networks[crypto.toUpperCase()] || 'Unknown Network';
}

function validateTransactionHash(hash, crypto) {
    const patterns = {
        'BTC': /^[a-fA-F0-9]{64}$/,
        'ETH': /^0x[a-fA-F0-9]{64}$/,
        'LTC': /^[a-fA-F0-9]{64}$/,
        'DOGE': /^[a-fA-F0-9]{64}$/
    };
    
    const pattern = patterns[crypto.toUpperCase()];
    return pattern ? pattern.test(hash) : false;
}

function generateMockTransactionHash(crypto) {
    if (crypto.toUpperCase() === 'ETH') {
        return '0x' + Math.random().toString(16).substr(2, 64);
    } else {
        return Math.random().toString(16).substr(2, 64);
    }
}

// ===== END COINREMITTER SYSTEM =====

const port = 3000;
app.listen(port, () => {
  console.log(`Express server running at http://localhost:${port}/`);
});