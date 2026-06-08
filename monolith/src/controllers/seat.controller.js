const seatService = require('../services/seat.service');

/**
 * GET /seats/availability?trainId=xxx
 * High-frequency read. Returns seat count from MongoDB.
 * Under refresh storm this becomes the first bottleneck.
 */
const checkAvailability = async (req, res) => {
  try {
    const { trainId } = req.query;
    if (!trainId) {
      return res.status(400).json({ error: 'trainId query param is required' });
    }
    const result = await seatService.checkAvailability(trainId);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

module.exports = { checkAvailability };
