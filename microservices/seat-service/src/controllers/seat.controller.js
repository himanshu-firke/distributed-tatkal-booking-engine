const seatService = require('../services/seat.service');

const getAvailability = async (req, res) => {
  try {
    const { trainId } = req.query;
    if (!trainId) return res.status(400).json({ error: 'trainId query param is required' });

    const data = await seatService.getAvailability(trainId);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

const getAllTrains = async (req, res) => {
  try {
    const trains = await seatService.getAllTrains();
    return res.status(200).json({ trains });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

module.exports = { getAvailability, getAllTrains };
