const mongoose = require('mongoose');

const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Auth DB] Connected:', process.env.MONGO_URI);
  } catch (err) {
    console.error('[Auth DB] Connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = { connect };
