const express = require('express');
const router  = express.Router();
const { getAvailability, getAllTrains } = require('../controllers/seat.controller');

router.get('/availability', getAvailability);  // GET /seats/availability?trainId=<id>
router.get('/trains',       getAllTrains);      // GET /seats/trains

module.exports = router;
