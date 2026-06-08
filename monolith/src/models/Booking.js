const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trainId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Train', required: true },
    seatNumber: { type: Number },
    status:   { type: String, enum: ['confirmed', 'failed'], default: 'confirmed' },
    // Unique constraint prevents duplicate bookings from retry storms at DB level
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
