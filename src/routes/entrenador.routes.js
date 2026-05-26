var express = require('express');
var router  = express.Router();
var ctrl    = require('../controllers/entrenador.controller');

router.get('/stats/:id',               ctrl.stats);
router.get('/activity/:id',            ctrl.activity);
router.get('/atletas/:id',             ctrl.atletasDelEntrenador);
router.post('/solicitar-club',         ctrl.solicitarClub);
router.get('/solicitudes/:id',         ctrl.solicitudesEntrenador);
router.get('/perfil/:id',              ctrl.perfil);
router.put('/perfil/:id',              ctrl.actualizarPerfil);
router.get('/verificar-estructura',    ctrl.verificarEstructura);

module.exports = router;
