const express = require('express');

const authRoutes = require('./routes/auth.routes');
const seatRoutes = require('./routes/seat.routes');
const bookingRoutes = require('./routes/booking.routes');

const app = express();

app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/seats', seatRoutes);
app.use('/bookings', bookingRoutes);

// Health check — used by k6 and Docker
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'tatkal-monolith' });
});

module.exports = app;
