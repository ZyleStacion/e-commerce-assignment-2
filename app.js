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

// For each product display
// app.use('/products', productRoutes);

// Homepage
app.get('/', (req, res) => {
  res.render('index');
})

app.get('/cart', (req, res) => {
  res.render('cart', { cartItems: [] });
})

const port = 3000;
app.listen(port, () => {
  console.log(`Express server running at http://localhost:${port}/`);
});