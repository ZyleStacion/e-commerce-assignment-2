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

// ===== COINREMITTER CRYPTOCURRENCY PAYMENT ENDPOINTS =====

// Check Coinremitter availability
app.get('/api/coinremitter/check-availability', (req, res) => {
  try {
    // Check if credentials are configured
    if (!coinremitterWalletKey || !coinremitterPassword) {
      return res.json({ 
        success: false, 
        error: 'Coinremitter credentials not configured' 
      });
    }

    // Available cryptocurrencies for testing
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

// Create cryptocurrency invoice
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

    // Validate crypto currency
    const supportedCryptos = ['BTC', 'ETH', 'LTC', 'DOGE'];
    if (!supportedCryptos.includes(crypto.toUpperCase())) {
      return res.json({ 
        success: false, 
        error: `Cryptocurrency ${crypto} not supported` 
      });
    }

    console.log(`Creating ${crypto} invoice for $${amount}`);

    // For testing purposes, simulate Coinremitter API response
    // In production, you would make actual API calls to Coinremitter
    const invoiceId = `INV_${Date.now()}_${crypto}`;
    const cryptoAmount = await convertUSDToCrypto(amount, crypto);
    
    // Generate test wallet address (in production, this comes from Coinremitter API)
    const testAddress = generateTestAddress(crypto);
    
    // Create mock invoice response
    const invoice = {
      invoice_id: invoiceId,
      total_amount: cryptoAmount,
      crypto_currency: crypto,
      fiat_amount: amount,
      fiat_currency: currency || 'USD',
      address: testAddress,
      qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${crypto}:${testAddress}?amount=${cryptoAmount}`,
      expire_time: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes from now
      status: 'waiting',
      created_at: new Date().toISOString()
    };

    // Store invoice in memory (in production, store in database)
    if (!global.coinremitterInvoices) {
      global.coinremitterInvoices = {};
    }
    global.coinremitterInvoices[invoiceId] = {
      ...invoice,
      order_id: orderId,
      status: 'waiting'
    };

    console.log(`Created ${crypto} invoice:`, invoiceId);

    res.json({ 
      success: true, 
      invoice: invoice 
    });

  } catch (error) {
    console.error('Error creating Coinremitter invoice:', error);
    res.json({ 
      success: false, 
      error: 'Failed to create cryptocurrency invoice' 
    });
  }
});

// Check payment status
app.get('/api/coinremitter/payment-status/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    // Get invoice from memory (in production, query database)
    const invoice = global.coinremitterInvoices ? global.coinremitterInvoices[invoiceId] : null;
    
    if (!invoice) {
      return res.json({ 
        success: false, 
        error: 'Invoice not found' 
      });
    }

    // Check if invoice expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime > invoice.expire_time) {
      invoice.status = 'expired';
      res.json({ 
        success: true, 
        status: 'expired',
        message: 'Invoice has expired'
      });
      return;
    }

    // For testing, simulate payment progression
    // In production, you would query Coinremitter API for actual payment status
    const timeSinceCreation = Date.now() - new Date(invoice.created_at).getTime();
    
    // Simulate payment detection after 2 minutes for testing
    if (timeSinceCreation > 120000 && invoice.status === 'waiting') { // 2 minutes
      invoice.status = 'pending';
      invoice.confirmations = 1;
      invoice.transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;
    }
    
    // Simulate confirmation after 4 minutes for testing
    if (timeSinceCreation > 240000 && invoice.status === 'pending') { // 4 minutes
      invoice.status = 'confirmed';
      invoice.confirmations = 6;
    }

    res.json({ 
      success: true, 
      status: invoice.status,
      confirmations: invoice.confirmations || 0,
      transactionHash: invoice.transactionHash || null,
      crypto: invoice.crypto_currency
    });

  } catch (error) {
    console.error('Error checking payment status:', error);
    res.json({ 
      success: false, 
      error: 'Failed to check payment status' 
    });
  }
});

// Helper function to convert USD to cryptocurrency (mock implementation)
async function convertUSDToCrypto(usdAmount, crypto) {
  // Mock exchange rates for testing (in production, use real API)
  const mockRates = {
    'BTC': 45000,  // $45,000 per BTC
    'ETH': 3000,   // $3,000 per ETH
    'LTC': 100,    // $100 per LTC
    'DOGE': 0.10   // $0.10 per DOGE
  };
  
  const rate = mockRates[crypto.toUpperCase()] || 1;
  const cryptoAmount = (usdAmount / rate).toFixed(8);
  
  return parseFloat(cryptoAmount);
}

// Helper function to generate test wallet addresses
function generateTestAddress(crypto) {
  const prefixes = {
    'BTC': '1',
    'ETH': '0x',
    'LTC': 'L',
    'DOGE': 'D'
  };
  
  const prefix = prefixes[crypto.toUpperCase()] || '1';
  
  if (crypto.toUpperCase() === 'ETH') {
    return '0x' + Math.random().toString(16).substr(2, 40);
  } else {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let address = prefix;
    for (let i = 0; i < 33; i++) {
      address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return address;
  }
}

// ===== END COINREMITTER ENDPOINTS =====

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

const port = 3000;
app.listen(port, () => {
  console.log(`Express server running at http://localhost:${port}/`);
});