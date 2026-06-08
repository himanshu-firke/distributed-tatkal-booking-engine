const router = require('express').Router();
const { bookSeat } = require('../controllers/booking.controller');
const authMiddleware = require('../middleware/auth.middleware');

// POST /bookings  — JWT required
router.post('/', authMiddleware, bookSeat);

module.exports = router;
