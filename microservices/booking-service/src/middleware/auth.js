const jwt = require('jsonwebtoken');

/**
 * JWT Authentication Middleware
 *
 * Validates JWT locally using the shared JWT_SECRET.
 * Does NOT call Auth Service — no inter-service HTTP request.
 * This keeps the booking critical path free of network dependencies.
 */
const authenticate = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;  // { userId, email, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
