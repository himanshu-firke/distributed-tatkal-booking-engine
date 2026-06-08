require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Monolith] Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Monolith] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
