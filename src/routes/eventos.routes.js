var express = require('express');
var router  = express.Router();
var ctrl    = require('../controllers/eventos.controller');

router.get('/convocatorias-para-atleta',           ctrl.convocatoriasParaAtleta);
router.get('/inscripciones',                       ctrl.listarInscripciones);
router.post('/inscripciones',                      ctrl.crearInscripcion);
router.get('/',                                    ctrl.listarEventos);
router.post('/',                                   ctrl.crearEvento);
router.get('/:eventoId/participantes',             ctrl.participantes);
router.put('/:id/actualizar-fecha-cierre',         ctrl.actualizarFechaCierre);
router.post('/:eventoId/convocatorias',            ctrl.agregarConvocatoria);

module.exports = router;
