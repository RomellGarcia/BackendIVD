const express = require('express');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const router = express.Router();
const saltRounds = 10;

// POST /api/registros
router.post('/', async (req, res) => {
  const {
    nombre,
    apellidopa,
    apellidoma,
    fechaNacimiento,
    rol,
    telefono,
    gmail,
    password,
    sexo,
    estadoNacimiento,
    curp,
    clubId // Nuevo campo opcional
  } = req.body;

  // Validación de campos obligatorios
  if (
    !nombre || !apellidopa || !apellidoma ||
    !fechaNacimiento || !rol || !telefono ||
    !gmail || !password || !sexo ||
    !estadoNacimiento || !curp
  ) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  // Validación básica de CURP (18 caracteres alfanuméricos)
  if (!/^[A-Za-z0-9]{18}$/.test(curp)) {
    return res.status(400).json({ error: 'La CURP debe tener exactamente 18 caracteres alfanuméricos' });
  }

  try {
    const db = req.db;

    // Validación para evitar CURPs duplicadas
    const curpExistente = await db.collection('registro').findOne({ curp });
    if (curpExistente) {
      return res.status(400).json({ error: 'La CURP ingresada ya está registrada' });
    }

    // (Opcional) Validar correo electrónico único
    const correoExistente = await db.collection('registro').findOne({ gmail });
    if (correoExistente) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    // Convertir la fecha al formato ISO
    const fechaISO = new Date(fechaNacimiento).toISOString();

    // Crear nuevo usuario
    const nuevoUsuario = {
      curp,
      nombre,
      apellidopa,
      apellidoma,
      fechaNacimiento: fechaISO,
      rol,
      telefono,
      gmail,
      password: await bcrypt.hash(password, saltRounds),
      sexo,
      estadoNacimiento,
      fechaRegistro: new Date(),
    };
    // Si es atleta y se proporciona clubId, agregarlo
    if (rol === 'atleta' && clubId) {
      nuevoUsuario.clubId = clubId;
    }

    // Guardar en MongoDB
    const result = await db.collection('registro').insertOne(nuevoUsuario);

    if (result.insertedId) {
      console.log(`✅ Usuario guardado con _id: ${result.insertedId}`);
      res.status(201).json({
        message: 'Registro creado exitosamente',
        usuario: { ...nuevoUsuario, _id: result.insertedId },
      });
    } else {
      throw new Error('Fallo al insertar el registro en la base de datos');
    }

  } catch (error) {
    console.error('❌ Error al crear el registro:', error);
    res.status(500).json({
      error: 'No se pudo crear el registro',
      details: error.message,
    });
  }
});

// GET /api/clubes - Listar todos los clubes
router.get('/clubes', async (req, res) => {
  try {
    const db = req.db;
    // Cambiar a la colección 'club' en vez de 'registro'
    const clubes = await db.collection('club').find({}).toArray();
    res.json(clubes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener clubes', details: error.message });
  }
});

// GET /api/atletas - Listar atletas, filtrar por clubId o independientes
router.get('/atletas', async (req, res) => {
  try {
    const db = req.db;
    const { clubId, independientes } = req.query;
    let filtro = { rol: 'atleta' };
    if (clubId) {
      filtro.clubId = clubId;
    } else if (independientes === 'true') {
      filtro.$or = [ { clubId: { $exists: false } }, { clubId: '' }, { clubId: null } ];
    }
    const atletas = await db.collection('registro').find(filtro).toArray();
    res.json(atletas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener atletas', details: error.message });
  }
});

// PUT /api/atletas/:id/club - Asignar o quitar club a un atleta
router.put('/atletas/:id/club', async (req, res) => {
  try {
    const db = req.db;
    const atletaId = req.params.id;
    const { clubId } = req.body; // clubId puede ser string o null
    const update = clubId ? { clubId } : { $unset: { clubId: '' } };
    const result = await db.collection('registro').updateOne(
      { _id: new ObjectId(atletaId), rol: 'atleta' },
      clubId ? { $set: { clubId } } : { $unset: { clubId: '' } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Atleta no encontrado' });
    }
    res.json({ message: 'Club actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar club del atleta', details: error.message });
  }
});

// GET /api/registros/atleta/:id - Obtener datos del atleta
router.get('/atleta/:id', async (req, res) => {
  try {
    const db = req.db;
    const atleta = await db.collection('registro').findOne({ _id: new ObjectId(req.params.id), rol: 'atleta' });
    if (!atleta) return res.status(404).json({ error: 'Atleta no encontrado' });
    res.json(atleta);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener atleta', details: error.message });
  }
});

// PUT /api/registros/atleta/:id - Actualizar datos personales del atleta (excepto CURP)
router.put('/atleta/:id', async (req, res) => {
  try {
    const db = req.db;
    const { nombre, apellidopa, apellidoma, fechaNacimiento, telefono, gmail, sexo, estadoNacimiento } = req.body;
    // No se permite actualizar curp ni rol
    const update = { nombre, apellidopa, apellidoma, fechaNacimiento, telefono, gmail, sexo, estadoNacimiento };
    const result = await db.collection('registro').updateOne(
      { _id: new ObjectId(req.params.id), rol: 'atleta' },
      { $set: update }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Atleta no encontrado' });
    res.json({ message: 'Datos actualizados correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar atleta', details: error.message });
  }
});

// POST /api/registros/solicitudes-club - Crear solicitud de cambio de club/independiente
router.post('/solicitudes-club', async (req, res) => {
  try {
    const db = req.db;
    const { atletaId, clubId, tipo } = req.body; // tipo: 'asociar' o 'independiente'
    const atleta = await db.collection('registro').findOne({ _id: new ObjectId(atletaId), rol: 'atleta' });
    if (!atleta) return res.status(404).json({ error: 'Atleta no encontrado' });
    // Si ya tiene club y quiere asociar a otro, rechazar
    if (tipo === 'asociar' && atleta.clubId) {
      return res.status(400).json({ error: 'Debes dejar tu club actual antes de solicitar otro.' });
    }
    // Si ya tiene club y solicita independencia, permitir
    // Solo permitir una solicitud pendiente a la vez
    const solicitudPendiente = await db.collection('solicitudesClub').findOne({ atletaId, estado: 'pendiente' });
    if (solicitudPendiente) {
      return res.status(400).json({ error: 'Ya tienes una solicitud pendiente.' });
    }
    if (tipo === 'asociar' && clubId) {
      const club = await db.collection('club').findOne({ _id: new ObjectId(clubId) });
      if (!club) return res.status(404).json({ error: 'Club no encontrado' });
    }
    const solicitud = {
      atletaId,
      clubId: tipo === 'asociar' ? clubId : null,
      tipo,
      estado: 'pendiente',
      fechaSolicitud: new Date(),
    };
    await db.collection('solicitudesClub').insertOne(solicitud);
    res.status(201).json({ message: 'Solicitud enviada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear solicitud', details: error.message });
  }
});

// GET /api/registros/solicitudes-club?clubId=... - Listar solicitudes para un club
router.get('/solicitudes-club', async (req, res) => {
  try {
    const db = req.db;
    const { clubId } = req.query;
    let filtro = {};
    if (clubId) filtro.clubId = clubId;
    const solicitudes = await db.collection('solicitudesClub').find(filtro).toArray();
    res.json(solicitudes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener solicitudes', details: error.message });
  }
});

// PUT /api/registros/solicitudes-club/:id - Club acepta/rechaza solicitud
router.put('/solicitudes-club/:id', async (req, res) => {
  try {
    const db = req.db;
    const { estado } = req.body; // 'aceptada' o 'rechazada'
    const solicitud = await db.collection('solicitudesClub').findOne({ _id: new ObjectId(req.params.id) });
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (solicitud.estado !== 'pendiente') return res.status(400).json({ error: 'La solicitud ya fue procesada' });
    // Si se acepta, quitar clubId anterior y asignar el nuevo club
    if (estado === 'aceptada' && solicitud.tipo === 'asociar') {
      await db.collection('registro').updateOne(
        { _id: new ObjectId(solicitud.atletaId), rol: 'atleta' },
        { $set: { clubId: solicitud.clubId } }
      );
    }
    if (estado === 'aceptada' && solicitud.tipo === 'independiente') {
      await db.collection('registro').updateOne(
        { _id: new ObjectId(solicitud.atletaId), rol: 'atleta' },
        { $unset: { clubId: '' } }
      );
    }
    await db.collection('solicitudesClub').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { estado } }
    );
    res.json({ message: 'Solicitud procesada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar solicitud', details: error.message });
  }
});

// GET /api/registros/club/:id - Obtener datos del club
router.get('/club/:id', async (req, res) => {
  try {
    const db = req.db;
    const club = await db.collection('registro').findOne({ _id: new ObjectId(req.params.id), rol: 'club' });
    if (!club) return res.status(404).json({ error: 'Club no encontrado' });
    res.json(club);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener club', details: error.message });
  }
});

module.exports = router;
