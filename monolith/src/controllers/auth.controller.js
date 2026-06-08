const authService = require('../services/auth.service');

/**
 * POST /auth/login
 * Delegates to authService. Returns JWT on success.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const token = await authService.login(email, password);
    res.json({ token });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

module.exports = { login };
