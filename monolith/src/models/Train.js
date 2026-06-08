const mongoose = require('mongoose');

const trainSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  source:      { type: String, required: true },
  destination: { type: String, required: true },
  totalSeats:  { type: Number, required: true },
  // ⚠️ This field is the center of the race condition.
  // Two concurrent reads of this value before either write = overselling.
  availableSeats: { type: Number, required: true },
  date: { type: Date, required: true },
});

module.exports = mongoose.model('Train', trainSchema);
