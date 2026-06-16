const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId:         { type: String, required: true },      // from JWT payload
  trainId:        { type: String, required: true },
  status:         { type: String, enum: ['confirmed', 'failed'], default: 'confirmed' },
  idempotencyKey: { type: String, required: true, unique: true }, // prevents duplicate bookings
}, { timestamps: true });

bookingSchema.index({ userId: 1 });
bookingSchema.index({ trainId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
