require('dotenv').config();

const express = require('express');
const db      = require('./config/db');
const redis   = require('./config/redis');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'seat', port: PORT });
});

app.use('/seats', require('./routes/seat.routes'));

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

const start = async () => {
  await db.connect();
  await redis.connect();
  app.listen(PORT, () => {
    console.log(`[Seat Service] Running on port ${PORT}`);
  });
};

start();
