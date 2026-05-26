var pool       = require('../config/db');
var cloudinary = require('cloudinary').v2;

function parseBool(val) {
    return val === true || val === 'true' || val === 1 || val === '1';
}

// GET /api/perfilEmpresa
function obtener(req, res) {
    Promise.all([
        pool.query('SELECT * FROM perfil_empresa LIMIT 1'),
        pool.query('SELECT plataforma, url FROM redes_sociales WHERE empresa_id = (SELECT id FROM perfil_empresa LIMIT 1)')
    ])
    .then(function(results) {
        if (results[0].rows.length === 0) {
            return res.json({
                nombreEmpresa: 'Instituto Veracruzano del Deporte',
                eslogan: '', logo: '', direccion: '', correo: '', telefono: '',
                facebook: '', instagram: '', twitter: '', mostrarWhatsapp: true
            });
        }
        var perfil = results[0].rows[0];
        var redes  = results[1].rows;

        // Convertir redes_sociales a campos planos
        var facebook = '', instagram = '', twitter = '';
        redes.forEach(function(r) {
            if (r.plataforma === 'facebook')  facebook  = r.url;
            if (r.plataforma === 'instagram') instagram = r.url;
            if (r.plataforma === 'twitter')   twitter   = r.url;
        });

        res.json({
            id:              perfil.id,
            nombreEmpresa:   perfil.nombre_empresa,
            eslogan:         perfil.eslogan,
            logo:            perfil.logo,
            direccion:       perfil.direccion,
            correo:          perfil.correo,
            telefono:        perfil.telefono,
            mostrarWhatsapp: parseBool(perfil.mostrar_whatsapp),
            facebook:        facebook,
            instagram:       instagram,
            twitter:         twitter
        });
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
    if (!/^\d{10}$/.test(telefono)) return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return res.status(400).json({ error: 'Introduce un correo electrónico válido' });

    pool.query('SELECT id FROM perfil_empresa LIMIT 1')
        .then(function(r) {
            if (r.rows.length > 0) return Promise.reject({ status: 400, error: 'Ya existe un perfil registrado' });
            if (req.files && req.files.logo) {
                return cloudinary.uploader.upload(req.files.logo.tempFilePath, {
                    folder: 'instituto-veracruzano-deporte/perfil'
                }).then(function(result) { return result.secure_url; });
            }
            return '';
        })
        .then(function(logoUrl) {
            return pool.query(
                `INSERT INTO perfil_empresa (nombre_empresa, eslogan, logo, direccion, correo, telefono, mostrar_whatsapp, fecha_creacion, fecha_actualizacion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING id`,
                [nombreEmpresa, eslogan, logoUrl, direccion, correo, telefono, mostrarWhatsapp]
            );
        })
        .then(function(r) {
            var empresaId = r.rows[0].id;
            var redes = [];
            if (facebook)  redes.push(pool.query('INSERT INTO redes_sociales (empresa_id, plataforma, url) VALUES ($1,$2,$3)', [empresaId, 'facebook', facebook]));
            if (instagram) redes.push(pool.query('INSERT INTO redes_sociales (empresa_id, plataforma, url) VALUES ($1,$2,$3)', [empresaId, 'instagram', instagram]));
            if (twitter)   redes.push(pool.query('INSERT INTO redes_sociales (empresa_id, plataforma, url) VALUES ($1,$2,$3)', [empresaId, 'twitter', twitter]));
            return Promise.all(redes).then(function() { return empresaId; });
        })
        .then(function(empresaId) {
            res.status(201).json({ message: 'Perfil creado exitosamente', id: empresaId });
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
    if (!/^\d{10}$/.test(telefono)) return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return res.status(400).json({ error: 'Introduce un correo electrónico válido' });

    var perfilId;
    pool.query('SELECT id, logo FROM perfil_empresa LIMIT 1')
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, error: 'No se encontró un perfil para actualizar' });
            perfilId = r.rows[0].id;
            var logoActual = r.rows[0].logo || '';
            if (req.files && req.files.logo) {
                return cloudinary.uploader.upload(req.files.logo.tempFilePath, {
                    folder: 'instituto-veracruzano-deporte/perfil'
                }).then(function(result) { return result.secure_url; });
            }
            return logoActual;
        })
        .then(function(logoUrl) {
            return pool.query(
                `UPDATE perfil_empresa SET nombre_empresa=$1, eslogan=$2, logo=$3, direccion=$4,
                 correo=$5, telefono=$6, mostrar_whatsapp=$7, fecha_actualizacion=NOW()
                 WHERE id=$8`,
                [nombreEmpresa, eslogan, logoUrl, direccion, correo, telefono, mostrarWhatsapp, perfilId]
            );
        })
        .then(function() {
            // Actualizar redes: borrar e insertar
            return pool.query('DELETE FROM redes_sociales WHERE empresa_id = $1', [perfilId]);
        })
        .then(function() {
            var redes = [];
            if (facebook)  redes.push(pool.query('INSERT INTO redes_sociales (empresa_id, plataforma, url) VALUES ($1,$2,$3)', [perfilId, 'facebook', facebook]));
            if (instagram) redes.push(pool.query('INSERT INTO redes_sociales (empresa_id, plataforma, url) VALUES ($1,$2,$3)', [perfilId, 'instagram', instagram]));
            if (twitter)   redes.push(pool.query('INSERT INTO redes_sociales (empresa_id, plataforma, url) VALUES ($1,$2,$3)', [perfilId, 'twitter', twitter]));
            return Promise.all(redes);
        })
        .then(function() {
            res.json({ message: 'Perfil actualizado exitosamente' });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('❌ Error al actualizar perfil:', err);
            res.status(500).json({ error: 'No se pudo actualizar el perfil', details: err.message });
        });
}

// DELETE /api/perfilEmpresa
function eliminar(req, res) {
    pool.query('SELECT id FROM perfil_empresa LIMIT 1')
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, error: 'No se encontró un perfil para eliminar' });
            var id = r.rows[0].id;
            return pool.query('DELETE FROM redes_sociales WHERE empresa_id = $1', [id])
                .then(function() { return pool.query('DELETE FROM perfil_empresa WHERE id = $1', [id]); });
        })
        .then(function() { res.json({ message: 'Perfil eliminado exitosamente' }); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            res.status(500).json({ error: 'No se pudo eliminar el perfil', details: err.message });
        });
}

module.exports = { obtener, crear, actualizar, eliminar };
