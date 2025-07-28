const http = require('http');
const router = require('router');
const express = require('express');

// Set view engine
app.set('view engine', 'ejs');
app.set('views', __dirname);

// Middleware
app.use(express.json());

// For each product display
app.use('/products', prodcutRoutes);

// Homepage
app.get('/', (req, res) => {
  res.render('index');
})

app.get('/cart', (req, res) => {
  res.render('cart');
})

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, Node.js!');
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});