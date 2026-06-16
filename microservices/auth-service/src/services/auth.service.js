const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

/**
 * Register a new user.
 * Used by seed script — not exposed as a public API endpoint in production.
 */
const register = async ({ name, email, password }) => {
  const existing = await User.findOne({ email });
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
  const hash   = await bcrypt.hash(password, rounds);

  const user = await User.create({ name, email, password: hash });
  return { userId: user._id };
};

/**
 * Validate credentials and issue a JWT.
 *
 * ⚠️  This is the CPU bottleneck in the monolith.
 * In the microservice architecture, this runs in its own process (port 3001).
 * bcrypt.compare() here does NOT block the Booking Service event loop.
 */
const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const token = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  return { token };
};

module.exports = { register, login };
