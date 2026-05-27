//src/routes/eventos.routes.js
var express    = require('express');
var router     = express.Router();
var controller = require('../controllers/eventos.controller');

//Rutas fijas
router.get('/convocatorias-para-atleta', controller.convocatoriasParaAtleta);
router.get('/debug-atleta/:atletaId',    controller.debugAtleta);
router.get('/debug-eventos',             controller.debugEventos);
router.get('/inscripciones',             controller.obtenerInscripciones);
router.post('/inscripciones',            controller.inscribir);

//Rutas de eventos
router.get('/',    controller.obtenerTodos);
router.post('/',   controller.crear);

//Rutas con parámetro :id 
router.post('/:eventoId/convocatorias',        controller.agregarConvocatoria);
router.put('/:id/actualizar-fecha-cierre',     controller.actualizarFechaCierre);
router.get('/:eventoId/participantes',         controller.obtenerParticipantes);

module.exports = router;