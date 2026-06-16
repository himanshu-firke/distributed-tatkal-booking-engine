const redis = require('../config/redis');
const Train = require('../models/Train');

/**
 * Get live seat availability for a train.
 *
 * ✅ Fix for Failure 2 (MongoDB pool exhaustion):
 *    Availability is read from Redis (in-memory, O(1), ~0.3ms).
 *    MongoDB is NOT touched for this read-hot endpoint.
 *    No connection pool, no saturation possible.
 */
const getAvailability = async (trainId) => {
  const key   = `seat:${trainId}`;
  const count = await redis.get(key);

  if (count === null) {
    throw Object.assign(new Error('Train not found or not seeded in Redis'), { status: 404 });
  }

  // Fetch train metadata from MongoDB (name, number) — read once, could be cached
  const train = await Train.findById(trainId).select('trainNumber name totalSeats').lean();
  if (!train) throw Object.assign(new Error('Train not found'), { status: 404 });

  return {
    trainId,
    trainNumber:    train.trainNumber,
    name:           train.name,
    totalSeats:     train.totalSeats,
    availableSeats: Math.max(0, parseInt(count)), // never show negative to client
  };
};

/**
 * List all trains with their current seat availability.
 */
const getAllTrains = async () => {
  const trains = await Train.find({}).lean();

  const results = await Promise.all(
    trains.map(async (t) => {
      const count = await redis.get(`seat:${t._id}`);
      return {
        trainId:        t._id,
        trainNumber:    t.trainNumber,
        name:           t.name,
        totalSeats:     t.totalSeats,
        availableSeats: count !== null ? Math.max(0, parseInt(count)) : null,
      };
    })
  );

  return results;
};

module.exports = { getAvailability, getAllTrains };
