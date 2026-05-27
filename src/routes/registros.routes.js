//src/routes/registros.routes.js
var express    = require('express');
var router     = express.Router();
var controller = require('../controllers/registros.controller');

//Rutas fijas
router.get('/clubes',                      controller.listarClubes);
router.get('/atletas',                     controller.listarAtletas);
router.get('/atletas-club',                controller.listarAtletasDeClub);
router.get('/atleta/:id',                  controller.obtenerAtleta);
router.get('/club/:id',                    controller.obtenerClub);
router.put('/atletas/:id/club',            controller.actualizarClubAtleta);

router.post('/solicitudes-club',           controller.crearSolicitudClub);
router.get('/solicitudes-club',            controller.listarSolicitudesClub);
router.put('/solicitudes-club/:id',        controller.procesarSolicitudClub);

//Rutas generales
router.get('/',    controller.listarUsuarios);
router.post('/',   controller.crear);
router.put('/:id', controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;