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

const port = 3000;
app.listen(port, () => {
  console.log(`Express server running at http://localhost:${port}/`);
});