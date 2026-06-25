const express = require('express');
const router = express.Router();

const { asyncHandler, authUser } = require('../auth/checkAuth');
const controllerReservation = require('../controllers/reservationV2.controller');

router.post('/api/create-reservation', authUser, asyncHandler(controllerReservation.createReservation));
router.get('/api/get-reservations', authUser, asyncHandler(controllerReservation.getReservations));
router.post('/api/update-reservation', authUser, asyncHandler(controllerReservation.updateReservation));

module.exports = router;
