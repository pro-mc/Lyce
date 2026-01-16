const express = require('express');
const app = express();

const PORT = 5000;
const HOST = '0.0.0.0';

app.get('/', (req, res) => {
  res.send('<h1>Welcome to Lyce</h1><p>Your application is running!</p>');
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
