require('dotenv').config();

const express = require('express');
const db      = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth', port: PORT });
});

// Routes
app.use('/auth', require('./routes/auth.routes'));

// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Start
const start = async () => {
  await db.connect();
  app.listen(PORT, () => {
    console.log(`[Auth Service] Running on port ${PORT}`);
  });
};

start();
