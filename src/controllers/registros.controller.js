//src/controllers/registros.controller.js
var bcrypt       = require('bcrypt');
var Registro     = require('../models/registro.model');
var calcularEdad = require('../utils/calcularEdad');

//POST/api/registros
function crear(req, res) {
    var nombre           = req.body.nombre;
    var apellidopa       = req.body.apellidopa;
    var apellidoma       = req.body.apellidoma;
    var fechaNacimiento  = req.body.fechaNacimiento;
    var rol              = req.body.rol;
    var telefono         = req.body.telefono;
    var gmail            = req.body.gmail;
    var password         = req.body.password;
    var sexo             = req.body.sexo;
    var estadoNacimiento = req.body.estadoNacimiento;
    var curp             = req.body.curp;
    var clubId           = req.body.clubId;
    var certificaciones  = req.body.certificaciones;
    var especialidades   = req.body.especialidades;
    var añosExperiencia  = req.body.añosExperiencia;
    var estado           = req.body.estado;

    // Validar obligatorios
    if (!nombre || !apellidopa || !apellidoma || !fechaNacimiento || !rol ||
        !telefono || !gmail || !password || !sexo || !estadoNacimiento || !curp) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (!/^[A-Za-z0-9]{18}$/.test(curp)) {
        return res.status(400).json({ error: 'La CURP debe tener exactamente 18 caracteres alfanuméricos' });
    }

    var telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length !== 10) {
        return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos' });
    }

    Promise.all([
        Registro.existeCurp(curp),
        Registro.existeGmail(gmail)
    ])
    .then(function(resultados) {
        if (resultados[0]) throw { status: 400, message: 'La CURP ingresada ya está registrada' };
        if (resultados[1]) throw { status: 400, message: 'El correo electrónico ya está registrado' };

        return Registro.crear({
            curp,
            nombre,
            apellidopa,
            apellidoma,
            fechaNacimiento: new Date(fechaNacimiento).toISOString(),
            rol,
            telefono:        telefonoLimpio,
            gmail,
            password,
            sexo,
            estadoNacimiento,
            clubId:          (rol === 'atleta' || rol === 'entrenador') ? clubId : null,
            certificaciones: rol === 'entrenador' ? (certificaciones || []) : null,
            especialidades:  rol === 'entrenador' ? (especialidades  || []) : null,
            añosExperiencia: rol === 'entrenador' ? (añosExperiencia || 0)  : 0,
            estado:          estado || 'activo'
        });
    })
    .then(function(usuario) {
        console.log('Usuario guardado con id:', usuario.id);
        res.status(201).json({
            message: 'Registro creado exitosamente',
            usuario: usuario
        });
    })
    .catch(function(error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Error al crear el registro:', error);
        res.status(500).json({ error: 'No se pudo crear el registro', details: error.message });
    });
}

//GET/api/registros/clubes
function listarClubes(req, res) {
    Registro.obtenerClubes()
        .then(function(clubes) { res.json(clubes); })
        .catch(function(error) {
            res.status(500).json({ error: 'Error al obtener clubes', details: error.message });
        });
}

//GET /api/registros/atletas
function listarAtletas(req, res) {
    var clubId        = req.query.clubId        || null;
    var independientes = req.query.independientes === 'true';

    Registro.obtenerAtletas({ clubId, independientes })
        .then(function(atletas) { res.json(atletas); })
        .catch(function(error) {
            res.status(500).json({ error: 'Error al obtener atletas', details: error.message });
        });
}

//PUT/api/registros/atletas/:id/club
function actualizarClubAtleta(req, res) {
    var id     = req.params.id;
    var clubId = req.body.clubId !== undefined ? req.body.clubId : null;

    Registro.actualizarClubAtleta(id, clubId)
        .then(function(resultado) {
            if (!resultado) return res.status(404).json({ error: 'Atleta no encontrado' });
            res.json({ message: 'Club actualizado correctamente' });
        })
        .catch(function(error) {
            res.status(500).json({ error: 'Error al actualizar club del atleta', details: error.message });
        });
}

//GET/api/registros/atleta/:id
function obtenerAtleta(req, res) {
    Registro.obtenerAtletaPorAtletaId(req.params.id)
        .then(function(atleta) {
            if (!atleta) return res.status(404).json({ error: 'Atleta no encontrado' });
            res.json(atleta);
        })
        .catch(function(error) {
            res.status(500).json({ error: 'Error al obtener atleta', details: error.message });
        });
        
}

//GET/api/registros/atletas-club
function listarAtletasDeClub(req, res) {
    var clubId = req.query.clubId;
    var limite = req.query.limit ? parseInt(req.query.limit, 10) : null;
    var sort   = req.query.sort  || null;

    if (!clubId) return res.status(400).json({ error: 'clubId es requerido' });

    Registro.obtenerAtletasPorClub(clubId, {
        limit: isNaN(limite) ? null : limite,
        sort:  sort
    })
    .then(function(atletas) {
        var atletasConEdad = atletas.map(function(atleta) {
            return Object.assign({}, atleta, {
                edad: calcularEdad(atleta.fecha_nacimiento)
            });
        });
        res.json(atletasConEdad);
    })
    .catch(function(error) {
        res.status(500).json({ error: 'Error al obtener atletas del club', details: error.message });
    });
}

//GET/api/registros/club/:id
function obtenerClub(req, res) {
    Registro.obtenerPorId(req.params.id)
        .then(function(usuario) {
            if (!usuario || usuario.rol !== 'club') {
                return res.status(404).json({ error: 'Club no encontrado' });
            }
            res.json(usuario);
        })
        .catch(function(error) {
            res.status(500).json({ error: 'Error al obtener club', details: error.message });
        });
}

//GET /api/registros
function listarUsuarios(req, res) {
    Registro.obtenerUsuarios({
        rol:    req.query.rol    || null,
        sinClub: req.query.sinClub === 'true'
    })
    .then(function(usuarios) { res.json(usuarios); })
    .catch(function(error) {
        res.status(500).json({ error: 'Error al obtener usuarios', details: error.message });
    });
}

//PUT /api/registros/:id
function actualizar(req, res) {
    var id = req.params.id;

    Registro.obtenerPorId(id)
        .then(function(usuario) {
            if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };

            //Caso especial: solo se actualiza clubId del atleta
            var llaves = Object.keys(req.body);
            if (usuario.rol === 'atleta' && llaves.length === 1 && req.body.hasOwnProperty('clubId')) {
                return Registro.actualizarClubAtleta(id, req.body.clubId)
                    .then(function(resultado) {
                        if (!resultado) throw { status: 404, message: 'Atleta no encontrado' };
                        var msg = req.body.clubId
                            ? 'Atleta asociado correctamente al club'
                            : 'Atleta desasociado correctamente del club';
                        res.json({ message: msg });
                    });
            }

            return Registro.actualizar(id, req.body)
                .then(function(actualizado) {
                    if (!actualizado) throw { status: 404, message: 'Usuario no encontrado' };
                    res.json(actualizado);
                });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('❌ Error al actualizar usuario:', error);
            res.status(500).json({ error: 'Error al actualizar usuario', details: error.message });
        });
}

//POST/api/registros/solicitudes-club
function crearSolicitudClub(req, res) {
    var atletaId = req.body.atletaId;
    var clubId   = req.body.clubId;
    var tipo     = req.body.tipo;

    Registro.obtenerAtletaPorId(atletaId)
        .then(function(atleta) {
            if (!atleta) throw { status: 404, message: 'Atleta no encontrado' };

            if (tipo === 'asociar' && atleta.club_id) {
                throw { status: 400, message: 'Debes dejar tu club actual antes de solicitar otro.' };
            }

            return Registro.obtenerSolicitudesPendientesAtleta(atletaId);
        })
        .then(function(pendiente) {
            if (pendiente) throw { status: 400, message: 'Ya tienes una solicitud pendiente.' };

            if (tipo === 'asociar' && clubId) {
                return Registro.verificarClubExiste(clubId).then(function(existe) {
                    if (!existe) throw { status: 404, message: 'Club no encontrado' };
                });
            }
        })
        .then(function() {
            return Registro.crearSolicitudClub({ atletaId, clubId, tipo });
        })
        .then(function() {
            res.status(201).json({ message: 'Solicitud enviada correctamente' });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            res.status(500).json({ error: 'Error al crear solicitud', details: error.message });
        });
}

//GET/api/registros/solicitudes-club
function listarSolicitudesClub(req, res) {
    Registro.obtenerSolicitudesClub({
        clubId:   req.query.clubId   || null,
        atletaId: req.query.atletaId || null
    })
    .then(function(solicitudes) { res.json(solicitudes); })
    .catch(function(error) {
        res.status(500).json({ error: 'Error al obtener solicitudes', details: error.message });
    });
}

//PUT/api/registros/solicitudes-club/:id
function procesarSolicitudClub(req, res) {
    var solicitudId = req.params.id;
    var estado      = req.body.estado;

    Registro.obtenerSolicitudClubPorId(solicitudId)
        .then(function(solicitud) {
            if (!solicitud) throw { status: 404, message: 'Solicitud no encontrada' };
            if (solicitud.estado !== 'pendiente') {
                throw { status: 400, message: 'La solicitud ya fue procesada' };
            }
            return Registro.procesarSolicitudClub(solicitudId, estado, solicitud);
        })
        .then(function() {
            res.json({ message: 'Solicitud procesada correctamente' });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            res.status(500).json({ error: 'Error al procesar solicitud', details: error.message });
        });
}

//DELETE /api/registros/:id
function eliminar(req, res) {
    var id = req.params.id;

    Registro.obtenerPorId(id)
        .then(function(usuario) {
            if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };

            if (usuario.rol === 'atleta') {
                return Promise.all([
                    Registro.contarResultadosAtleta(id),
                    Registro.contarInscripcionesAtleta(id)
                ]).then(function(totales) {
                    if (totales[0] > 0) {
                        throw { status: 400, message: 'No se puede eliminar el atleta porque tiene resultados registrados. Primero elimine todos los resultados asociados.' };
                    }
                    if (totales[1] > 0) {
                        throw { status: 400, message: 'No se puede eliminar el atleta porque está participando en eventos. Primero elimine sus participaciones.' };
                    }
                });
            }

            if (usuario.rol === 'club') {
                return Registro.contarAtletasDeClub(id).then(function(total) {
                    if (total > 0) {
                        throw { status: 400, message: 'No se puede eliminar el club porque tiene atletas asociados. Primero desasocia todos los atletas.' };
                    }
                });
            }
        })
        .then(function() {
            return Registro.eliminar(id);
        })
        .then(function(eliminado) {
            if (!eliminado) throw { status: 404, message: 'Usuario no encontrado' };
            res.json({ message: 'Usuario eliminado correctamente' });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al eliminar usuario:', error);
            res.status(500).json({ error: 'Error al eliminar usuario', details: error.message });
        });
}

module.exports = {
    crear,
    listarClubes,
    listarAtletas,
    actualizarClubAtleta,
    obtenerAtleta,
    listarAtletasDeClub,
    obtenerClub,
    listarUsuarios,
    actualizar,
    crearSolicitudClub,
    listarSolicitudesClub,
    procesarSolicitudClub,
    eliminar
};