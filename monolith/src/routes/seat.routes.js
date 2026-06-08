const router = require('express').Router();
const { checkAvailability } = require('../controllers/seat.controller');

// GET /seats/availability?trainId=xxx
router.get('/availability', checkAvailability);

module.exports = router;
