// controllers/perfilEmpresa.controller.js
var pool      = require('../config/db');
var cloudinary = require('cloudinary').v2;

function parseBool(val) {
    return val === true || val === 'true' || val === 1 || val === '1';
}

// GET /api/perfilEmpresa
function obtener(req, res) {
    pool.query('SELECT * FROM contenido_estatico WHERE tipo = $1 LIMIT 1', ['perfilEmpresa'])
        .then(function(r) {
            if (r.rows.length === 0) {
                // Retornar defaults igual que el original
                return res.json({
                    nombreEmpresa: 'Instituto Veracruzano del Deporte',
                    eslogan: '', logo: '', direccion: '',
                    correo: '', telefono: '',
                    facebook: '', instagram: '', twitter: '',
                    mostrarWhatsapp: true
                });
            }
            var perfil = r.rows[0];
            // El contenido está guardado como JSON en la columna 'contenido'
            var datos = perfil.contenido ? JSON.parse(perfil.contenido) : {};
            datos.mostrarWhatsapp = parseBool(datos.mostrarWhatsapp !== undefined ? datos.mostrarWhatsapp : true);
            res.json(datos);
        })
        .catch(function(err) {
            console.error('❌ Error al obtener perfil:', err);
            res.status(500).json({ error: 'Error al obtener el perfil' });
        });
}

// POST /api/perfilEmpresa
function crear(req, res) {
    var nombreEmpresa   = req.body.nombreEmpresa;
    var eslogan         = req.body.eslogan;
    var direccion       = req.body.direccion;
    var correo          = req.body.correo;
    var telefono        = req.body.telefono;
    var facebook        = req.body.facebook  || '';
    var instagram       = req.body.instagram || '';
    var twitter         = req.body.twitter   || '';
    var mostrarWhatsapp = parseBool(req.body.mostrarWhatsapp !== undefined ? req.body.mostrarWhatsapp : true);

    if (!nombreEmpresa || !eslogan || !direccion || !correo || !telefono) {
        return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos' });
    }
    if (!/^\d{10}$/.test(telefono)) {
        return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos numéricos' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        return res.status(400).json({ error: 'Introduce un correo electrónico válido' });
    }

    pool.query('SELECT id FROM contenido_estatico WHERE tipo = $1', ['perfilEmpresa'])
        .then(function(r) {
            if (r.rows.length > 0) return Promise.reject({ status: 400, error: 'Ya existe un perfil registrado' });

            var subirLogo;
            if (req.files && req.files.logo) {
                subirLogo = cloudinary.uploader.upload(req.files.logo.tempFilePath, {
                    folder: 'instituto-veracruzano-deporte/perfil'
                }).then(function(result) { return result.secure_url; });
            } else {
                subirLogo = Promise.resolve('');
            }
            return subirLogo;
        })
        .then(function(logoUrl) {
            var datos = { nombreEmpresa: nombreEmpresa, eslogan: eslogan, logo: logoUrl,
                          direccion: direccion, correo: correo, telefono: telefono,
                          facebook: facebook, instagram: instagram, twitter: twitter,
                          mostrarWhatsapp: mostrarWhatsapp };
            return pool.query(
                'INSERT INTO contenido_estatico (tipo, titulo, contenido, updated_at) VALUES ($1,$2,$3,NOW()) RETURNING *',
                ['perfilEmpresa', nombreEmpresa, JSON.stringify(datos)]
            );
        })
        .then(function(r) {
            var datos = JSON.parse(r.rows[0].contenido);
            res.status(201).json({ message: 'Perfil creado exitosamente', perfil: datos });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('❌ Error al crear perfil:', err);
            res.status(500).json({ error: 'No se pudo crear el perfil', details: err.message });
        });
}

// PUT /api/perfilEmpresa
function actualizar(req, res) {
    var nombreEmpresa   = req.body.nombreEmpresa;
    var eslogan         = req.body.eslogan;
    var direccion       = req.body.direccion;
    var correo          = req.body.correo;
    var telefono        = req.body.telefono;
    var facebook        = req.body.facebook  || '';
    var instagram       = req.body.instagram || '';
    var twitter         = req.body.twitter   || '';
    var mostrarWhatsapp = parseBool(req.body.mostrarWhatsapp);

    if (!nombreEmpresa || !eslogan || !direccion || !correo || !telefono) {
        return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos' });
    }
    if (!/^\d{10}$/.test(telefono)) {
        return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos numéricos' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        return res.status(400).json({ error: 'Introduce un correo electrónico válido' });
    }

    var logoActual;
    pool.query('SELECT id, contenido FROM contenido_estatico WHERE tipo = $1', ['perfilEmpresa'])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, error: 'No se encontró un perfil para actualizar' });
            var datosActuales = r.rows[0].contenido ? JSON.parse(r.rows[0].contenido) : {};
            logoActual = datosActuales.logo || '';

            var subirLogo;
            if (req.files && req.files.logo) {
                subirLogo = cloudinary.uploader.upload(req.files.logo.tempFilePath, {
                    folder: 'instituto-veracruzano-deporte/perfil'
                }).then(function(result) { return result.secure_url; });
            } else {
                subirLogo = Promise.resolve(logoActual);
            }
            return subirLogo;
        })
        .then(function(logoUrl) {
            var datos = { nombreEmpresa: nombreEmpresa, eslogan: eslogan, logo: logoUrl,
                          direccion: direccion, correo: correo, telefono: telefono,
                          facebook: facebook, instagram: instagram, twitter: twitter,
                          mostrarWhatsapp: mostrarWhatsapp };
            return pool.query(
                'UPDATE contenido_estatico SET titulo=$1, contenido=$2, updated_at=NOW() WHERE tipo=$3 RETURNING *',
                [nombreEmpresa, JSON.stringify(datos), 'perfilEmpresa']
            );
        })
        .then(function(r) {
            var datos = JSON.parse(r.rows[0].contenido);
            res.json({ message: 'Perfil actualizado exitosamente', perfil: datos });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('❌ Error al actualizar perfil:', err);
            res.status(500).json({ error: 'No se pudo actualizar el perfil', details: err.message });
        });
}

// DELETE /api/perfilEmpresa
function eliminar(req, res) {
    pool.query('SELECT id FROM contenido_estatico WHERE tipo = $1', ['perfilEmpresa'])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, error: 'No se encontró un perfil para eliminar' });
            return pool.query('DELETE FROM contenido_estatico WHERE tipo = $1', ['perfilEmpresa']);
        })
        .then(function() { res.json({ message: 'Perfil eliminado exitosamente' }); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('❌ Error al eliminar perfil:', err);
            res.status(500).json({ error: 'No se pudo eliminar el perfil', details: err.message });
        });
}

module.exports = { obtener, crear, actualizar, eliminar };
