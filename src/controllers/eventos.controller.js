// src/controllers/eventos.controller.js
var Evento = require('../model/evento.model');

//calcular edad real a partir de fechaNacimiento
function calcularEdad(fechaNacimiento) {
    var hoy     = new Date();
    var fechaNac = new Date(fechaNacimiento);
    var edad    = hoy.getFullYear() - fechaNac.getFullYear();
    var mes     = hoy.getMonth() - fechaNac.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
        edad--;
    }
    return edad;
}

//Validar convocatoria individual
function validarConvocatoria(conv, indice) {
    var prefijo = indice !== undefined ? 'Convocatoria ' + (indice + 1) + ': ' : '';

    if (!conv.disciplina || !conv.categoria || !conv.genero ||
        conv.edadMin === undefined || conv.edadMax === undefined) {
        return prefijo + 'disciplina, categoría, género, edad mínima y máxima son requeridos';
    }

    var edadMinNum = parseInt(conv.edadMin, 10);
    var edadMaxNum = parseInt(conv.edadMax, 10);

    if (isNaN(edadMinNum) || isNaN(edadMaxNum)) {
        return prefijo + 'La edad mínima y máxima deben ser números válidos';
    }

    return null;
}

//POST/api/eventos
function crear(req, res) {
    var titulo        = req.body.titulo;
    var fecha         = req.body.fecha;
    var hora          = req.body.hora;
    var lugar         = req.body.lugar;
    var descripcion   = req.body.descripcion;
    var convocatorias = req.body.convocatorias;

    if (!titulo || !fecha || !hora || !lugar || !Array.isArray(convocatorias) || convocatorias.length === 0) {
        return res.status(400).json({ message: 'Título, fecha, hora, lugar y al menos una convocatoria son requeridos' });
    }

    //Validar cada convocatoria antes de tocar la BD
    for (var i = 0; i < convocatorias.length; i++) {
        var errorConv = validarConvocatoria(convocatorias[i], i);
        if (errorConv) return res.status(400).json({ message: errorConv });
    }

    //Fecha de cierre: 24h antes del evento
    var fechaEvento   = new Date(fecha);
    var fechaCierre   = new Date(fechaEvento.getTime() - 24 * 60 * 60 * 1000);

    Evento.crearEvento({
        titulo:      titulo.trim(),
        fecha:       fechaEvento,
        hora:        hora.trim(),
        lugar:       lugar.trim(),
        descripcion: descripcion,
        fechaCierre: fechaCierre
    })
    .then(function(evento) {
        //Insertar convocatorias en secuencia
        var promesas = convocatorias.map(function(conv) {
            return Evento.crearConvocatoria(evento.id, conv);
        });
        return Promise.all(promesas).then(function(convsCreadas) {
            evento.convocatorias = convsCreadas;
            return evento;
        });
    })
    .then(function(eventoCompleto) {
        res.status(201).json(eventoCompleto);
    })
    .catch(function(error) {
        console.error('Error al crear el evento:', error);
        res.status(500).json({ message: 'Error al crear el evento', error: error.message });
    });
}

//POST/api/eventos/:eventoId/convocatorias
function agregarConvocatoria(req, res) {
    var eventoId    = req.params.eventoId;
    var convocatoria = req.body;

    var errorConv = validarConvocatoria(convocatoria);
    if (errorConv) return res.status(400).json({ message: errorConv });

    Evento.obtenerPorId(eventoId)
        .then(function(evento) {
            if (!evento) throw { status: 404, message: 'Evento no encontrado' };
            return Evento.crearConvocatoria(eventoId, convocatoria);
        })
        .then(function() {
            return Evento.obtenerEventoConConvocatorias(eventoId);
        })
        .then(function(eventoActualizado) {
            res.json(eventoActualizado);
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ message: error.message });
            console.error('Error al agregar convocatoria:', error);
            res.status(500).json({ message: 'Error al agregar convocatoria', error: error.message });
        });
}

//GET/api/eventos
function obtenerTodos(req, res) {
    var limite = req.query.limit ? parseInt(req.query.limit, 10) : null;

    Evento.obtenerTodos(isNaN(limite) ? null : limite)
        .then(function(eventos) { res.json(eventos); })
        .catch(function(error) {
            console.error('Error al obtener eventos:', error);
            res.status(500).json({ message: 'Error al obtener eventos', error: error.message });
        });
}

//GET/api/eventos/convocatorias-para-atleta?edad=17&genero=masculino
function convocatoriasParaAtleta(req, res) {
    var edad   = Number(req.query.edad);
    var genero = (req.query.genero || '').toLowerCase();

    if (isNaN(edad) || req.query.edad === undefined) {
        return res.status(400).json({ message: 'Edad inválida o no proporcionada' });
    }
    if (!genero) {
        return res.status(400).json({ message: 'Género es requerido' });
    }

    Evento.obtenerConvocatoriasParaAtleta(edad, genero)
        .then(function(rows) {
            //Mapear a la misma estructura que esperaba el frontend
            var resultado = rows.map(function(r) {
                return {
                    _id:            r.id,
                    titulo:         r.titulo,
                    fecha:          r.fecha,
                    hora:           r.hora,
                    lugar:          r.lugar,
                    descripcion:    r.descripcion,
                    disciplina:     r.disciplina,
                    categoria:      r.categoria,
                    edadMin:        r.edad_min,
                    edadMax:        r.edad_max,
                    genero:         r.genero,
                    paraPersonas:   r.para_personas,
                    fechaCierre:    r.fecha_cierre,
                    estado:         r.estado,
                    convocatoriaId: r.convocatoria_id
                };
            });
            res.json(resultado);
        })
        .catch(function(error) {
            console.error('❌ Error al filtrar convocatorias para atleta:', error);
            res.status(500).json({ message: 'Error al filtrar convocatorias', error: error.message });
        });
}

//GET/api/eventos/debug-atleta/:atletaId
function debugAtleta(req, res) {
    var atletaId = req.params.atletaId;

    Evento.obtenerAtletaPorId(atletaId)
        .then(function(atleta) {
            if (!atleta) throw { status: 404, message: 'Atleta no encontrado' };

            var edadCalculada = calcularEdad(atleta.fecha_nacimiento);

            res.json({
                atleta: {
                    id:              atleta.id,
                    nombre:          atleta.nombre,
                    curp:            atleta.curp,
                    fechaNacimiento: atleta.fecha_nacimiento,
                    sexo:            atleta.sexo,
                    rol:             atleta.rol
                },
                calculos: {
                    fechaActual:     new Date(),
                    fechaNacimiento: atleta.fecha_nacimiento,
                    edadCalculada:   edadCalculada,
                    genero:          atleta.sexo ? atleta.sexo.toLowerCase() : null
                }
            });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ message: error.message });
            console.error('Error en debug atleta:', error);
            res.status(500).json({ message: 'Error al obtener datos del atleta', error: error.message });
        });
}

//GET/api/eventos/debug-eventos
function debugEventos(req, res) {
    Evento.obtenerResumenEventos()
        .then(function(resumen) {
            var fechaActual = new Date();
            res.json({
                fechaActual:          fechaActual,
                totalEventos:         resumen.totalEventos,
                eventosActivos:       resumen.eventosActivos,
                eventosAbiertos:      resumen.eventosAbiertos,
                todosEventos: resumen.detalle.map(function(e) {
                    return {
                        id:                e.id,
                        titulo:            e.titulo,
                        fechaCierre:       e.fecha_cierre,
                        estado:            e.estado,
                        fechaCierrePasada: e.fecha_cierre < fechaActual
                    };
                })
            });
        })
        .catch(function(error) {
            console.error('Error en debug eventos:', error);
            res.status(500).json({ message: 'Error al obtener datos de eventos', error: error.message });
        });
}

//PUT/api/eventos/:id/actualizar-fecha-cierre
function actualizarFechaCierre(req, res) {
    var id          = req.params.id;
    var fechaCierre = req.body.fechaCierre;

    if (!fechaCierre) {
        return res.status(400).json({ message: 'Fecha de cierre es requerida' });
    }

    var nuevaFecha = new Date(fechaCierre);
    if (isNaN(nuevaFecha.getTime())) {
        return res.status(400).json({ message: 'Fecha de cierre inválida' });
    }

    Evento.actualizarFechaCierre(id, nuevaFecha)
        .then(function(evento) {
            if (!evento) return res.status(404).json({ message: 'Evento no encontrado' });
            res.json({ message: 'Fecha de cierre actualizada exitosamente' });
        })
        .catch(function(error) {
            console.error('Error al actualizar fecha de cierre:', error);
            res.status(500).json({ message: 'Error al actualizar fecha de cierre', error: error.message });
        });
}

//POST/api/eventos/inscripciones─
function inscribir(req, res) {
    var eventoId   = req.body.eventoId;
    var atletaId   = req.body.atletaId;

    if (!eventoId || !atletaId) {
        return res.status(400).json({ message: 'Evento y atleta son requeridos' });
    }

    var eventoGuardado;
    var atletaGuardado;

    Promise.all([
        Evento.obtenerPorId(eventoId),
        Evento.obtenerAtletaPorId(atletaId)
    ])
    .then(function(resultados) {
        var evento = resultados[0];
        var atleta = resultados[1];

        if (!evento) throw { status: 404, message: 'Evento no encontrado' };
        if (!atleta) throw { status: 404, message: 'Atleta no encontrado' };

        if (new Date() > new Date(evento.fecha_cierre)) {
            throw { status: 400, message: 'La convocatoria ya está cerrada' };
        }

        var edadAtleta = calcularEdad(atleta.fecha_nacimiento);

        if (edadAtleta < evento.edad_min || edadAtleta > evento.edad_max) {
            throw {
                status: 400,
                message: 'La edad del atleta (' + edadAtleta + ' años) no cumple con el rango requerido (' + evento.edad_min + '-' + evento.edad_max + ' años)'
            };
        }

        var generoAtleta = atleta.sexo ? atleta.sexo.toLowerCase() : '';
        if (evento.genero !== 'mixto' && evento.genero !== generoAtleta) {
            throw {
                status: 400,
                message: 'El evento es solo para ' + (evento.genero === 'masculino' ? 'hombres' : 'mujeres')
            };
        }

        eventoGuardado = evento;
        atletaGuardado = atleta;

        return Evento.existeInscripcion(eventoId, atletaId);
    })
    .then(function(yaInscrito) {
        if (yaInscrito) throw { status: 400, message: 'Ya estás inscrito en este evento' };

        var edadAtleta = calcularEdad(atletaGuardado.fecha_nacimiento);

        return Evento.crearInscripcion({
            eventoId:      eventoId,
            atletaId:      atletaId,
            nombreCompleto: atletaGuardado.nombre + ' ' + atletaGuardado.apellidopa + ' ' + atletaGuardado.apellidoma,
            edad:          edadAtleta,
            genero:        atletaGuardado.sexo
        });
    })
    .then(function(inscripcion) {
        res.status(201).json({
            message:     'Inscripción exitosa',
            inscripcion: inscripcion,
            validaciones: {
                edad:      inscripcion.edad,
                genero:    inscripcion.genero,
                categoria: eventoGuardado.categoria
            }
        });
    })
    .catch(function(error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error('❌ Error al registrar inscripción:', error);
        res.status(500).json({ message: 'Error al registrar inscripción', error: error.message });
    });
}

//GET/api/eventos/inscripciones?atletaId=...&eventoId=...
function obtenerInscripciones(req, res) {
    Evento.obtenerInscripciones({
        atletaId: req.query.atletaId || null,
        eventoId: req.query.eventoId || null
    })
    .then(function(inscripciones) { res.json(inscripciones); })
    .catch(function(error) {
        res.status(500).json({ message: 'Error al obtener inscripciones', error: error.message });
    });
}

//GET/api/eventos/:eventoId/participantes
function obtenerParticipantes(req, res) {
    var eventoId = req.params.eventoId;

    Evento.obtenerPorId(eventoId)
        .then(function(evento) {
            if (!evento) throw { status: 404, message: 'Evento no encontrado' };
            return Evento.obtenerParticipantesPorEvento(eventoId);
        })
        .then(function(participantes) { res.json(participantes); })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ message: error.message });
            console.error('Error al obtener participantes:', error);
            res.status(500).json({ message: 'Error al obtener participantes', error: error.message });
        });
}

module.exports = {
    crear,
    agregarConvocatoria,
    obtenerTodos,
    convocatoriasParaAtleta,
    debugAtleta,
    debugEventos,
    actualizarFechaCierre,
    inscribir,
    obtenerInscripciones,
    obtenerParticipantes
};