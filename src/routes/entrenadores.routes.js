// src/routes/entrenadores.routes.js
var express    = require('express');
var router     = express.Router();
var controller = require('../controllers/entrenadores.controller');

router.get('/club/:clubId',              controller.obtenerPorClub);
router.get('/solicitudes-club/:clubId',  controller.obtenerSolicitudesPorClub);
router.put('/solicitudes/:solicitudId',  controller.actualizarSolicitud);
router.get('/test',                      controller.test);

module.exports = router;