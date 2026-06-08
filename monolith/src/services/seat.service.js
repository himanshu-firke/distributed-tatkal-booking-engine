const Train = require('../models/Train');

/**
 * Seat Service — checkAvailability
 * Reads directly from MongoDB.
 * Under a 2,500 req/sec refresh storm this saturates the connection pool.
 * Fixed in Phase 8 by serving this from Redis instead.
 */
const checkAvailability = async (trainId) => {
  const train = await Train.findById(trainId);
  if (!train) throw new Error('Train not found');

  return {
    trainId:        train._id,
    trainNumber:    train.trainNumber,
    source:         train.source,
    destination:    train.destination,
    totalSeats:     train.totalSeats,
    availableSeats: train.availableSeats,
  };
};

module.exports = { checkAvailability };
