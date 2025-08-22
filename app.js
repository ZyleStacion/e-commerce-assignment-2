const http = require('http');
const router = require('router');
const express = require('express');
const app = express();

// Set view engine
app.set('view engine', 'ejs');
const path = require('path');
app.set('views', path.join(__dirname, 'views'));

// Configure assets
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Middleware
app.use(express.json());

// Store cart data in memory
let storedCartData = [];

// For each product display
// app.use('/products', productRoutes);

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
  res.render('checkout', { shoppingCart: storedCartData });
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