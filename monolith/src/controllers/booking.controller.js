const bookingService = require('../services/booking.service');

/**
 * POST /bookings
 * Books a seat for the authenticated user.
 * Returns 201 on new booking, 200 if idempotency key already exists.
 */
const bookSeat = async (req, res) => {
  try {
    const { trainId, idempotencyKey } = req.body;
    const userId = req.user.userId;

    if (!trainId || !idempotencyKey) {
      return res.status(400).json({ error: 'trainId and idempotencyKey are required' });
    }

    const result = await bookingService.bookSeat(userId, trainId, idempotencyKey);
    const statusCode = result.alreadyExists ? 200 : 201;
    res.status(statusCode).json(result.booking);
  } catch (err) {
    if (err.message === 'No seats available') {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

module.exports = { bookSeat };
