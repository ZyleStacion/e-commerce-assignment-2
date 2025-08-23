const http = require('http');
const router = require('router');
const express = require('express');
const app = express();

/**
 *  PayPal backend dependencies 
 * */
import {
    ApiError,
    CheckoutPaymentIntent,
    Client,
    Environment,
    LogLevel,
    OrdersController,
    PaymentsController,
    PaypalExperienceLandingPage,
    PaypalExperienceUserAction,
    ShippingPreference,
} from "@paypal/paypal-server-sdk";
import bodyParser from "body-parser";
// Configure environment variables
require('dotenv').config();
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

// Set view engine
app.set('view engine', 'ejs');
const path = require('path');
const { ClientCredentialsAuthManager } = require('@paypal/paypal-server-sdk');
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
const paymentsController = new PaymentsController(client);

/**
 * Order handling
 */
const createOrder = async (cart) => {
  const collect = {
    body: {
      intent: "CAPTURE",
      purchaseUnits: [
        {
          amount: {
              currencyCode: "USD",
              value: storedCartData.total,
              breakdown: {
                item.TOtal:
              }
      ]
    }
  }
}

// Homepage
app.get('/', (req, res) => {
  res.render('index');
})

// Cart route (also grab items from the cart)
app.get('/cart', (req, res) => {
  res.render('cart', { shoppingCart: storedCartData });
})

// Checkout route
app.get('/checkout', (req, res) => {
  // Calculate total
  const total = storedCartData.reduce((sum, item) => {
    return sum + (item.quantity * parseFloat(item.price));
  }, 0);
  
  res.render('checkout', { 
    shoppingCart: storedCartData,
    total: total,
    paypalClientId: clientId
  });
})

// API endpoint recieves cart data
app.post('/api/cart', (req, res) => {
  const cartData = req.body;
  console.log("Cart data: ", cartData);
  
  // Store the cart data
  storedCartData = cartData;

  res.json({ success:true, message: 'Cart data received successfully' })
})

const port = 3000;
app.listen(port, () => {
  console.log(`Express server running at http://localhost:${port}/`);
});