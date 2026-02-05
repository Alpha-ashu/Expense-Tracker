// Example Express server setup
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Add more API routes here

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
