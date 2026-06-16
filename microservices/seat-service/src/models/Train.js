const mongoose = require('mongoose');

const trainSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  totalSeats:  { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Train', trainSchema);
