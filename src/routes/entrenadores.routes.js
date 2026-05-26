var express = require('express');
var router  = express.Router();
var ctrl    = require('../controllers/entrenadores.controller');

router.get('/club/:clubId',                   ctrl.entrenadorespPorClub);
router.get('/solicitudes-club/:clubId',        ctrl.solicitudesPorClub);
router.put('/solicitudes/:solicitudId',        ctrl.procesarSolicitud);

module.exports = router;
