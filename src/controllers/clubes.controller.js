//src/controllers/clubes.controller.js
var Club = require('../models/club.model');

//Helpers
function validarTelefono(telefono) {
    var limpio = telefono.replace(/\D/g, '');
    return limpio.length === 10 ? limpio : null;
}

//Controllers
function obtenerTodos(req, res) {
    Club.obtenerTodos()
        .then(function(clubes) { res.json(clubes); })
        .catch(function(error) {
            console.error('Error al obtener clubes:', error);
            res.status(500).json({ error: 'Error al obtener clubes', details: error.message });
        });
}

function obtenerPorId(req, res) {
    var id = req.params.id;

    Club.obtenerPorId(id)
        .then(function(club) {
            if (!club) return res.status(404).json({ error: 'Club no encontrado' });
            res.json(club);
        })
        .catch(function(error) {
            console.error('Error al obtener club:', error);
            res.status(500).json({ error: 'Error al obtener club', details: error.message });
        });
}

function crear(req, res) {
    var nombre      = req.body.nombre;
    var direccion   = req.body.direccion;
    var telefono    = req.body.telefono;
    var email       = req.body.email;
    var entrenador  = req.body.entrenador;
    var descripcion = req.body.descripcion;
    var estado      = req.body.estado  || 'activo';
    var password    = req.body.password;
    var rol         = req.body.rol     || 'club';

    //Validar
    if (!nombre || !direccion || !telefono || !password) {
        return res.status(400).json({ error: 'Nombre, dirección, teléfono y contraseña son obligatorios' });
    }

    var telefonoLimpio = validarTelefono(telefono);
    if (!telefonoLimpio) {
        return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos' });
    }

    //Validar nombre unico
    Club.obtenerPorNombre(nombre, null)
        .then(function(existente) {
            if (existente) throw { status: 400, message: 'Ya existe un club con ese nombre' };

            //Validar email unico
            if (!email) return null;
            return Club.obtenerPorEmail(email, null).then(function(emailExistente) {
                if (emailExistente) throw { status: 400, message: 'El email ya está registrado' };
            });
        })
        .then(function() {
            return Club.crear({ nombre, direccion, telefono: telefonoLimpio, email, entrenador, descripcion, estado, password, rol });
        })
        .then(function(nuevoClub) {
            res.status(201).json(nuevoClub);
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('❌ Error al crear club:', error);
            res.status(500).json({ error: 'No se pudo crear el club', details: error.message });
        });
}

function actualizar(req, res) {
    var id          = req.params.id;
    var nombre      = req.body.nombre;
    var direccion   = req.body.direccion;
    var telefono    = req.body.telefono;
    var email       = req.body.email;
    var entrenador  = req.body.entrenador;
    var descripcion = req.body.descripcion;
    var estado      = req.body.estado;

    //Validar
    if (!nombre || !direccion || !telefono) {
        return res.status(400).json({ error: 'Nombre, dirección y teléfono son obligatorios' });
    }

    var telefonoLimpio = validarTelefono(telefono);
    if (!telefonoLimpio) {
        return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos' });
    }

    //Verificar que el club existe
    Club.obtenerPorId(id)
        .then(function(club) {
            if (!club) throw { status: 404, message: 'Club no encontrado' };

            //Validar nombre unico
            return Club.obtenerPorNombre(nombre, id).then(function(duplicado) {
                if (duplicado) throw { status: 400, message: 'Ya existe otro club con ese nombre' };

                //Validar email unico
                if (!email) return club;
                return Club.obtenerPorEmail(email, id).then(function(emailDuplicado) {
                    if (emailDuplicado) throw { status: 400, message: 'El email ya está registrado por otro club' };
                    return club;
                });
            });
        })
        .then(function(clubActual) {
            return Club.actualizar(id, {
                nombre,
                direccion,
                telefono: telefonoLimpio,
                email,
                entrenador,
                descripcion,
                estado: estado || clubActual.estado
            });
        })
        .then(function(clubActualizado) {
            if (!clubActualizado) return res.status(404).json({ error: 'Club no encontrado' });
            res.json(clubActualizado);
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al actualizar club:', error);
            res.status(500).json({ error: 'Error al actualizar club', details: error.message });
        });
}

function eliminar(req, res) {
    var id = req.params.id;

    Club.obtenerPorId(id)
        .then(function(club) {
            if (!club) throw { status: 404, message: 'Club no encontrado' };

            //Verificar atletas asociados
            return Club.contarAtletasPorClub(id).then(function(total) {
                if (total > 0) {
                    throw {
                        status: 400,
                        message: 'No se puede eliminar el club porque tiene atletas asociados. Primero desasocia todos los atletas.'
                    };
                }
            });
        })
        .then(function() {
            return Club.eliminar(id);
        })
        .then(function(eliminado) {
            if (!eliminado) return res.status(404).json({ error: 'Club no encontrado' });
            res.json({ message: 'Club eliminado correctamente' });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al eliminar club:', error);
            res.status(500).json({ error: 'Error al eliminar club', details: error.message });
        });
}

function obtenerEstadisticas(req, res) {
    Club.obtenerEstadisticas()
        .then(function(stats) { res.json(stats); })
        .catch(function(error) {
            console.error('Error al obtener estadísticas:', error);
            res.status(500).json({ error: 'Error al obtener estadísticas', details: error.message });
        });
}

function asociarAtletas(req, res) {
    var id        = req.params.id;
    var atletaIds = req.body.atletaIds;

    if (!atletaIds || !Array.isArray(atletaIds) || atletaIds.length === 0) {
        return res.status(400).json({ error: 'Se requiere un array de IDs de atletas' });
    }

    Club.obtenerPorId(id)
        .then(function(club) {
            if (!club) throw { status: 404, message: 'Club no encontrado' };
            return Club.asociarAtletas(id, atletaIds);
        })
        .then(function(modificados) {
            res.json({
                message: modificados + ' atletas asociados correctamente al club',
                atletasAsociados: modificados
            });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al asociar atletas:', error);
            res.status(500).json({ error: 'Error al asociar atletas', details: error.message });
        });
}

function desasociarAtleta(req, res) {
    var id       = req.params.id;
    var atletaId = req.params.atletaId;

    Club.obtenerPorId(id)
        .then(function(club) {
            if (!club) throw { status: 404, message: 'Club no encontrado' };
            return Club.desasociarAtleta(atletaId, id);
        })
        .then(function(resultado) {
            if (!resultado) {
                return res.status(404).json({ error: 'Atleta no encontrado o no está asociado a este club' });
            }
            res.json({ message: 'Atleta desasociado correctamente del club' });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al desasociar atleta:', error);
            res.status(500).json({ error: 'Error al desasociar atleta', details: error.message });
        });
}

module.exports = {
    obtenerTodos,
    obtenerPorId,
    crear,
    actualizar,
    eliminar,
    obtenerEstadisticas,
    asociarAtletas,
    desasociarAtleta
};