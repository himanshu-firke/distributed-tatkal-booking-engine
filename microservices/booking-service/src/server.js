require('dotenv').config();

const express = require('express');
const db      = require('./config/db');
const redis   = require('./config/redis');

const app  = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'booking', port: PORT });
});

app.use('/bookings', require('./routes/booking.routes'));

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

const start = async () => {
  await db.connect();
  await redis.connect();
  app.listen(PORT, () => {
    console.log(`[Booking Service] Running on port ${PORT}`);
  });
};

start();
