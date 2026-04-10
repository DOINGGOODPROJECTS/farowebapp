
const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000;

// Enable CORS for frontend domains
app.use(cors({
  origin: [
    'https://chat.farosmart.com', // your static frontend
    'http://localhost:3000' // for local dev
  ],
  credentials: true // if you use cookies/auth
}));

// Respond to GET request on the root route
app.get('/', (req, res) => {
  res.send('GET request to the homepage');
});

// Respond to POST request on the root route
app.post('/', (req, res) => {
  res.send('POST request to the homepage');
});

// Respond to GET request on the /about route
app.get('/about', (req, res) => {
  res.send('About page');
});

// Catch all other routes
app.all('/{*path}', (req, res) => {
  res.status(404).send('404 - Page not found');
});

// Start the server
app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
}); 