const mongoose = require('mongoose');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[DB] MongoDB connected:', process.env.MONGO_URI);
};

module.exports = connectDB;
