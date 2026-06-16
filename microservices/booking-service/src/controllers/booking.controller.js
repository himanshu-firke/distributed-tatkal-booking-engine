const bookingService = require('../services/booking.service');

const createBooking = async (req, res) => {
  try {
    const { trainId, idempotencyKey } = req.body;
    if (!trainId || !idempotencyKey) {
      return res.status(400).json({ error: 'trainId and idempotencyKey are required' });
    }

    const booking = await bookingService.createBooking({
      userId:         req.user.userId,
      trainId,
      idempotencyKey,
    });

    return res.status(201).json({ booking });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

const getBooking = async (req, res) => {
  try {
    const booking = await bookingService.getBooking({
      bookingId: req.params.id,
      userId:    req.user.userId,
    });
    return res.status(200).json({ booking });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

module.exports = { createBooking, getBooking };
