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
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const mastercardGatewayUsername = process.env.MASTERCARD_GATEWAY_USERNAME;
const mastercardGatewayPassword = process.env.MASTERCARD_GATEWAY_PASSWORD;

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
    paypalClientId: clientId
  });
})

// Successful payment route
app.get('/success', (req, res) => {
  // Clear the cart after successful payment
  const orderDetails = {
    items: storedCartData,
    total: storedCartData.reduce((sum, item) => sum + (item.quantity * parseFloat(item.price)), 0)
  };
  
  // Clear the cart
  storedCartData = [];
  
  res.render('success', { orderDetails: orderDetails });
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

// Process Mastercard payments
app.post('/process-mastercard-payment', async (req, res) => {
    try {
        const { paymentData, amount, currency } = req.body;
        
        // Process the payment with Mastercard Gateway
        // Implementation depends on your Mastercard Gateway setup
        
        res.json({ success: true, transactionId: 'MC_' + Date.now() });
    } catch (error) {
        console.error('Payment processing error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Mastercard Hosted Checkout - Create Session
app.post('/api/mastercard/create-session', async (req, res) => {
    try {
        const { amount, currency, orderId } = req.body;
        
        console.log('Creating Mastercard session for amount:', amount);
        
        // Note: This is a placeholder implementation
        // In production, you would call Mastercard's API to create a real session
        // For now, we'll return a mock session ID for testing
        
        const mockSessionId = 'SESSION_' + Date.now() + '_' + Math.random().toString(36).substring(7);
        
        // In a real implementation, you would make an API call like:
        // const mastercardResponse = await fetch('https://ap-gateway.mastercard.com/api/rest/version/xx/merchant/xxx/session', {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Authorization': 'Basic ' + Buffer.from(username + ':' + password).toString('base64')
        //     },
        //     body: JSON.stringify({
        //         apiOperation: 'INITIATE_CHECKOUT',
        //         order: {
        //             id: orderId,
        //             amount: amount,
        //             currency: currency
        //         }
        //     })
        // });
        
        res.json({ 
            success: true, 
            sessionId: mockSessionId,
            message: 'Session created successfully (mock implementation)'
        });
        
    } catch (error) {
        console.error('Mastercard session creation error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Mastercard Hosted Checkout - Process Result
app.post('/api/mastercard/process-result', async (req, res) => {
    try {
        const { resultIndicator, sessionId } = req.body;
        
        console.log('Processing Mastercard result:', resultIndicator);
        
        // Note: This is a placeholder implementation
        // In production, you would verify the payment result with Mastercard's API
        
        // In a real implementation, you would make an API call like:
        // const mastercardResponse = await fetch(`https://ap-gateway.mastercard.com/api/rest/version/xx/merchant/xxx/session/${sessionId}`, {
        //     method: 'GET',
        //     headers: {
        //         'Authorization': 'Basic ' + Buffer.from(username + ':' + password).toString('base64')
        //     }
        // });
        
        res.json({ 
            success: true, 
            transactionId: 'MC_HOSTED_' + Date.now(),
            message: 'Payment processed successfully (mock implementation)'
        });
        
    } catch (error) {
        console.error('Mastercard result processing error:', error);
        res.json({ success: false, error: error.message });
    }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Express server running at http://localhost:${port}/`);
});