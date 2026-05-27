// src/routes/entrenador.routes.js
var express    = require('express');
var router     = express.Router();
var controller = require('../controllers/entrenador.controller');

// ── Rutas de datos ────────────────────────────────────────────────────────────
router.get('/stats/:id',          controller.obtenerStats);
router.get('/activity/:id',       controller.obtenerActividad);
router.get('/atletas/:id',        controller.obtenerAtletas);
router.get('/solicitudes/:id',    controller.obtenerSolicitudes);
router.get('/perfil/:id',         controller.obtenerPerfil);
router.put('/perfil/:id',         controller.actualizarPerfil);

// ── Solicitud a club ──────────────────────────────────────────────────────────
router.post('/verificar-datos',   controller.verificarDatos);
router.post('/solicitar-club',    controller.solicitarClub);

// ── Debug / diagnóstico ───────────────────────────────────────────────────────
router.get('/verificar-estructura',   controller.verificarEstructura);
router.get('/verificar-relacion/:id', controller.verificarRelacion);
router.get('/debug/:id',              controller.debug);

module.exports = router;