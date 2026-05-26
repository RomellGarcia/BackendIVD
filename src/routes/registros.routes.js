// Placeholder — registros.controller.js se generará cuando se revise registros.js
var express = require('express');
var router  = express.Router();
var pool    = require('../config/db');
var bcrypt  = require('bcrypt');
var saltRounds = 10;

// GET /api/registros
router.get('/', function(req, res) {
    var rol     = req.query.rol;
    var sinClub = req.query.sinClub;
    var query   = `SELECT u.id, u.curp, u.nombre, u.apellido_paterno, u.apellido_materno,
                          u.fecha_nacimiento, u.telefono, u.email, u.estado_nacimiento,
                          r.nombre AS rol, g.nombre AS sexo, a.club_id
                   FROM usuarios u
                   LEFT JOIN roles r ON u.rol_id = r.id
                   LEFT JOIN generos g ON u.genero_id = g.id
                   LEFT JOIN atletas a ON u.id = a.usuario_id
                   WHERE 1=1`;
    var params  = [];
    if (rol)              { params.push(rol); query += ' AND LOWER(r.nombre) = LOWER($' + params.length + ')'; }
    if (sinClub === 'true') query += ' AND a.club_id IS NULL';

    pool.query(query, params)
        .then(function(r) { res.json(r.rows); })
        .catch(function(err) { res.status(500).json({ error: err.message }); });
});

// GET /api/registros/atletas
router.get('/atletas', function(req, res) {
    var clubId         = req.query.clubId;
    var independientes = req.query.independientes;
    var query = `SELECT u.id, u.nombre, u.apellido_paterno, u.apellido_materno,
                        u.fecha_nacimiento, u.email, u.telefono, u.curp,
                        g.nombre AS sexo, a.club_id,
                        DATE_PART('year', AGE(u.fecha_nacimiento::date)) AS edad
                 FROM usuarios u
                 JOIN atletas a ON u.id = a.usuario_id
                 LEFT JOIN generos g ON u.genero_id = g.id
                 WHERE 1=1`;
    var params = [];
    if (clubId)                  { params.push(clubId); query += ' AND a.club_id = $' + params.length; }
    else if (independientes === 'true') query += ' AND a.club_id IS NULL';

    pool.query(query, params)
        .then(function(r) { res.json(r.rows); })
        .catch(function(err) { res.status(500).json({ error: err.message }); });
});

// GET /api/registros/atletas-club
router.get('/atletas-club', function(req, res) {
    var clubId = req.query.clubId;
    if (!clubId) return res.status(400).json({ error: 'clubId es requerido' });
    pool.query(
        `SELECT u.id, u.nombre, u.apellido_paterno, u.apellido_materno,
                u.fecha_nacimiento, u.email, u.telefono, u.curp,
                g.nombre AS sexo, a.club_id, a.fecha_ingreso_club,
                DATE_PART('year', AGE(u.fecha_nacimiento::date)) AS edad
         FROM usuarios u
         JOIN atletas a ON u.id = a.usuario_id
         LEFT JOIN generos g ON u.genero_id = g.id
         WHERE a.club_id = $1 ORDER BY u.id DESC`,
        [clubId]
    ).then(function(r) { res.json(r.rows); })
     .catch(function(err) { res.status(500).json({ error: err.message }); });
});

// GET /api/registros/atleta/:id
router.get('/atleta/:id', function(req, res) {
    pool.query(
        `SELECT u.*, a.club_id, a.municipio, a.lugar_entrenamiento, a.fecha_ingreso_club,
                g.nombre AS sexo, r.nombre AS rol
         FROM usuarios u
         JOIN atletas a ON u.id = a.usuario_id
         LEFT JOIN generos g ON u.genero_id = g.id
         LEFT JOIN roles r ON u.rol_id = r.id
         WHERE u.id = $1`,
        [req.params.id]
    ).then(function(r) {
        if (r.rows.length === 0) return res.status(404).json({ error: 'Atleta no encontrado' });
        res.json(r.rows[0]);
    }).catch(function(err) { res.status(500).json({ error: err.message }); });
});

// GET /api/registros/solicitudes-club
router.get('/solicitudes-club', function(req, res) {
    var clubId   = req.query.clubId;
    var atletaId = req.query.atletaId;
    var query    = 'SELECT * FROM solicitudes_club WHERE 1=1';
    var params   = [];
    if (clubId)   { params.push(clubId);   query += ' AND club_id = $' + params.length; }
    if (atletaId) { params.push(atletaId); query += ' AND usuario_id = $' + params.length; }
    pool.query(query, params)
        .then(function(r) { res.json(r.rows); })
        .catch(function(err) { res.status(500).json({ error: err.message }); });
});

// POST /api/registros
router.post('/', function(req, res) {
    var nombre          = req.body.nombre;
    var apellidopa      = req.body.apellidopa;
    var apellidoma      = req.body.apellidoma;
    var fechaNacimiento = req.body.fechaNacimiento;
    var rol             = req.body.rol;
    var telefono        = req.body.telefono;
    var gmail           = req.body.gmail;
    var password        = req.body.password;
    var sexo            = req.body.sexo;
    var estadoNac       = req.body.estadoNacimiento;
    var curp            = req.body.curp;
    var clubId          = req.body.clubId || null;
    var certificaciones = req.body.certificaciones || [];
    var especialidades  = req.body.especialidades  || [];
    var anosExp         = req.body.añosExperiencia || 0;
    var estado          = req.body.estado || 'activo';

    if (!nombre || !apellidopa || !apellidoma || !fechaNacimiento || !rol ||
        !telefono || !gmail || !password || !sexo || !estadoNac || !curp) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    if (!/^[A-Za-z0-9]{18}$/.test(curp)) return res.status(400).json({ error: 'CURP debe tener 18 caracteres alfanuméricos' });

    var telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length !== 10) return res.status(400).json({ error: 'El teléfono debe tener 10 dígitos' });

    pool.query('SELECT id FROM usuarios WHERE curp = $1', [curp])
        .then(function(r) {
            if (r.rows.length > 0) return Promise.reject({ status: 400, error: 'La CURP ya está registrada' });
            return pool.query('SELECT id FROM usuarios WHERE email = $1', [gmail]);
        })
        .then(function(r) {
            if (r.rows.length > 0) return Promise.reject({ status: 400, error: 'El correo ya está registrado' });
            return Promise.all([
                pool.query('SELECT id FROM generos WHERE LOWER(nombre) = LOWER($1)', [sexo]),
                pool.query('SELECT id FROM roles WHERE LOWER(nombre) = LOWER($1)', [rol])
            ]);
        })
        .then(function(results) {
            var generoId = results[0].rows[0] ? results[0].rows[0].id : null;
            var rolId    = results[1].rows[0] ? results[1].rows[0].id : null;
            return bcrypt.hash(password, saltRounds).then(function(hash) {
                return pool.query(
                    `INSERT INTO usuarios (curp, nombre, apellido_paterno, apellido_materno,
                     fecha_nacimiento, rol_id, telefono, email, password, genero_id, estado_nacimiento, fecha_registro)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING id`,
                    [curp, nombre, apellidopa, apellidoma, fechaNacimiento, rolId, telefonoLimpio, gmail, hash, generoId, estadoNac]
                );
            });
        })
        .then(function(r) {
            var usuarioId = r.rows[0].id;
            if (rol.toLowerCase() === 'atleta') {
                return pool.query('INSERT INTO atletas (usuario_id, club_id) VALUES ($1,$2)', [usuarioId, clubId])
                    .then(function() { return usuarioId; });
            }
            if (rol.toLowerCase() === 'entrenador') {
                return pool.query(
                    'INSERT INTO entrenadores (usuario_id, club_id, anos_experiencia, estado) VALUES ($1,$2,$3,$4) RETURNING id',
                    [usuarioId, clubId, anosExp, estado]
                ).then(function(r2) {
                    var entId = r2.rows[0].id;
                    var p = [];
                    certificaciones.forEach(function(c) { p.push(pool.query('INSERT INTO certificaciones (entrenador_id, nombre) VALUES ($1,$2)', [entId, c])); });
                    especialidades.forEach(function(e)  { p.push(pool.query('INSERT INTO especialidades (entrenador_id, nombre) VALUES ($1,$2)', [entId, e])); });
                    return Promise.all(p).then(function() { return usuarioId; });
                });
            }
            return usuarioId;
        })
        .then(function(usuarioId) {
            res.status(201).json({ message: 'Registro creado exitosamente', id: usuarioId });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('❌ Error al crear registro:', err);
            res.status(500).json({ error: 'No se pudo crear el registro', details: err.message });
        });
});

// PUT /api/registros/atletas/:id/club
router.put('/atletas/:id/club', function(req, res) {
    pool.query('UPDATE atletas SET club_id = $1 WHERE usuario_id = $2', [req.body.clubId || null, req.params.id])
        .then(function(r) {
            if (r.rowCount === 0) return res.status(404).json({ error: 'Atleta no encontrado' });
            res.json({ message: 'Club actualizado correctamente' });
        })
        .catch(function(err) { res.status(500).json({ error: err.message }); });
});

// POST /api/registros/solicitudes-club
router.post('/solicitudes-club', function(req, res) {
    var atletaId = req.body.atletaId;
    var clubId   = req.body.clubId;
    var tipo     = req.body.tipo;
    pool.query('SELECT id, club_id FROM atletas WHERE usuario_id = $1', [atletaId])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, error: 'Atleta no encontrado' });
            if (tipo === 'asociar' && r.rows[0].club_id) return Promise.reject({ status: 400, error: 'Debes dejar tu club actual antes de solicitar otro.' });
            return pool.query('SELECT id FROM solicitudes_club WHERE usuario_id = $1 AND estado = $2', [atletaId, 'pendiente']);
        })
        .then(function(r) {
            if (r.rows.length > 0) return Promise.reject({ status: 400, error: 'Ya tienes una solicitud pendiente.' });
            return pool.query(
                'INSERT INTO solicitudes_club (usuario_id, club_id, tipo, estado, fecha_solicitud) VALUES ($1,$2,$3,$4,NOW())',
                [atletaId, tipo === 'asociar' ? clubId : null, tipo, 'pendiente']
            );
        })
        .then(function() { res.status(201).json({ message: 'Solicitud enviada correctamente' }); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            res.status(500).json({ error: err.message });
        });
});

// PUT /api/registros/solicitudes-club/:id
router.put('/solicitudes-club/:id', function(req, res) {
    var estado = req.body.estado;
    pool.query('SELECT * FROM solicitudes_club WHERE id = $1', [req.params.id])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, error: 'Solicitud no encontrada' });
            var sol = r.rows[0];
            var p = [pool.query('UPDATE solicitudes_club SET estado = $1 WHERE id = $2', [estado, req.params.id])];
            if (estado === 'aceptada' && sol.tipo === 'asociar')       p.push(pool.query('UPDATE atletas SET club_id = $1, fecha_ingreso_club = NOW() WHERE usuario_id = $2', [sol.club_id, sol.usuario_id]));
            if (estado === 'aceptada' && sol.tipo === 'independiente') p.push(pool.query('UPDATE atletas SET club_id = NULL WHERE usuario_id = $1', [sol.usuario_id]));
            return Promise.all(p);
        })
        .then(function() { res.json({ message: 'Solicitud procesada correctamente' }); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            res.status(500).json({ error: err.message });
        });
});

// PUT /api/registros/:id
router.put('/:id', function(req, res) {
    var id     = req.params.id;
    var sets   = [];
    var params = [];
    var mapeo  = { apellidopa: 'apellido_paterno', apellidoma: 'apellido_materno', gmail: 'email', fechaNacimiento: 'fecha_nacimiento', estadoNacimiento: 'estado_nacimiento' };

    ['nombre','apellidopa','apellidoma','fechaNacimiento','telefono','gmail','estadoNacimiento'].forEach(function(k) {
        if (req.body[k] !== undefined) {
            params.push(req.body[k]);
            sets.push((mapeo[k] || k) + ' = $' + params.length);
        }
    });

    var p = [];
    if (sets.length > 0) { params.push(id); p.push(pool.query('UPDATE usuarios SET ' + sets.join(', ') + ' WHERE id = $' + params.length, params)); }
    if (req.body.clubId !== undefined) p.push(pool.query('UPDATE atletas SET club_id = $1 WHERE usuario_id = $2', [req.body.clubId || null, id]));

    Promise.all(p)
        .then(function() { res.json({ message: 'Datos actualizados correctamente' }); })
        .catch(function(err) { res.status(500).json({ error: err.message }); });
});

// DELETE /api/registros/:id
router.delete('/:id', function(req, res) {
    var id = req.params.id;
    pool.query('SELECT r.nombre AS rol FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = $1', [id])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, error: 'Usuario no encontrado' });
            return pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        })
        .then(function() { res.json({ message: 'Usuario eliminado correctamente' }); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            res.status(500).json({ error: err.message });
        });
});

module.exports = router;
