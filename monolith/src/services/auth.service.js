const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

/**
 * Auth Service — login
 *
 * The bcrypt.compare call below is intentionally CPU-bound.
 * At 10,000 concurrent logins, this saturates the Node.js event loop,
 * starving the booking service of CPU time.
 *
 * This is the failure we observe in Phase 6.
 * It is fixed in Phase 7 by isolating Auth into its own service.
 */
const login = async (email, password) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new Error('Invalid credentials');

  // ⚠️ CPU-BOUND OPERATION — blocks event loop for ~100ms per call
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Invalid credentials');

  const token = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  return token;
};

module.exports = { login };
