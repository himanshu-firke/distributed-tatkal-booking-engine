const express  = require('express');
const router   = express.Router();
const { authenticate } = require('../middleware/auth');
const { createBooking, getBooking } = require('../controllers/booking.controller');

router.post('/',    authenticate, createBooking);  // POST /bookings
router.get('/:id',  authenticate, getBooking);     // GET  /bookings/:id

module.exports = router;
