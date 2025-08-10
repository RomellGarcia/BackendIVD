const express = require('express');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const router = express.Router();
const saltRounds = 10;

// GET /api/clubes - Obtener todos los clubes
router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const clubes = await db.collection('club').find({}).toArray();
    res.json(clubes);
  } catch (error) {
    console.error('❌ Error al obtener clubes:', error);
    res.status(500).json({ error: 'Error al obtener clubes', details: error.message });
  }
});

// POST /api/clubes - Crear un nuevo club
router.post('/', async (req, res) => {
  const { 
    nombre, 
    direccion, 
    telefono, 
    email, 
    entrenador, 
    descripcion, 
    estado = 'activo',
    password,
    rol = 'club'
  } = req.body;

  // Validación de campos obligatorios
  if (!nombre || !direccion || !telefono || !password) {
    return res.status(400).json({ error: 'Nombre, dirección, teléfono y contraseña son obligatorios' });
  }

  // Validar formato de teléfono (exactamente 10 dígitos)
  const telefonoLimpio = telefono.replace(/\D/g, '');
  if (telefonoLimpio.length !== 10) {
    return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos' });
  }

  try {
    const db = req.db;

    // Validar que no exista un club con el mismo nombre
    const clubExistente = await db.collection('club').findOne({ nombre: nombre.trim() });
    if (clubExistente) {
      return res.status(400).json({ error: 'Ya existe un club con ese nombre' });
    }

    // Validar email único si se proporciona
    if (email) {
      const emailExistente = await db.collection('club').findOne({ email: email.trim() });
      if (emailExistente) {
        return res.status(400).json({ error: 'El email ya está registrado' });
      }
    }

    // Hashear la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const nuevoClub = {
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      telefono: telefono.trim(),
      email: email ? email.trim() : '',
      entrenador: entrenador ? entrenador.trim() : '',
      descripcion: descripcion ? descripcion.trim() : '',
      estado,
      rol,
      password: hashedPassword,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    };

    const result = await db.collection('club').insertOne(nuevoClub);

    if (result.insertedId) {
      const clubCreado = await db.collection('club').findOne({ _id: result.insertedId });
      res.status(201).json(clubCreado);
    } else {
      throw new Error('Fallo al insertar el club en la base de datos');
    }
  } catch (error) {
    console.error('❌ Error al crear el club:', error);
    res.status(500).json({
      error: 'No se pudo crear el club',
      details: error.message,
    });
  }
});

// GET /api/clubes/:id - Obtener un club específico
router.get('/:id', async (req, res) => {
  try {
    const db = req.db;
    const club = await db.collection('club').findOne({ _id: new ObjectId(req.params.id) });
    if (!club) {
      return res.status(404).json({ error: 'Club no encontrado' });
    }
    res.json(club);
  } catch (error) {
    console.error('❌ Error al obtener club:', error);
    res.status(500).json({ error: 'Error al obtener club', details: error.message });
  }
});

// PUT /api/clubes/:id - Actualizar un club
router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    const { 
      nombre, 
      direccion, 
      telefono, 
      email, 
      entrenador, 
      descripcion, 
      estado 
    } = req.body;

    // Validación de campos obligatorios
    if (!nombre || !direccion || !telefono) {
      return res.status(400).json({ error: 'Nombre, dirección y teléfono son obligatorios' });
    }

    // Validar formato de teléfono (exactamente 10 dígitos)
    const telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length !== 10) {
      return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos' });
    }

    // Verificar que el club existe
    const clubExistente = await db.collection('club').findOne({ _id: new ObjectId(req.params.id) });
    if (!clubExistente) {
      return res.status(404).json({ error: 'Club no encontrado' });
    }

    // Validar que no exista otro club con el mismo nombre (excepto el actual)
    const clubConMismoNombre = await db.collection('club').findOne({ 
      nombre: nombre.trim(), 
      _id: { $ne: new ObjectId(req.params.id) } 
    });
    if (clubConMismoNombre) {
      return res.status(400).json({ error: 'Ya existe otro club con ese nombre' });
    }

    // Validar email único si se proporciona (excepto el actual)
    if (email) {
      const emailExistente = await db.collection('club').findOne({ 
        email: email.trim(), 
        _id: { $ne: new ObjectId(req.params.id) } 
      });
      if (emailExistente) {
        return res.status(400).json({ error: 'El email ya está registrado por otro club' });
      }
    }

    const datosActualizados = {
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      telefono: telefono.trim(),
      email: email ? email.trim() : '',
      entrenador: entrenador ? entrenador.trim() : '',
      descripcion: descripcion ? descripcion.trim() : '',
      estado: estado || clubExistente.estado,
      fechaActualizacion: new Date()
    };

    const result = await db.collection('club').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: datosActualizados }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Club no encontrado' });
    }

    const clubActualizado = await db.collection('club').findOne({ _id: new ObjectId(req.params.id) });
    res.json(clubActualizado);
  } catch (error) {
    console.error('❌ Error al actualizar club:', error);
    res.status(500).json({ error: 'Error al actualizar club', details: error.message });
  }
});

// DELETE /api/clubes/:id - Eliminar un club
router.delete('/:id', async (req, res) => {
  try {
    const db = req.db;
    
    // Verificar que el club existe
    const club = await db.collection('club').findOne({ _id: new ObjectId(req.params.id) });
    if (!club) {
      return res.status(404).json({ error: 'Club no encontrado' });
    }

    // Verificar si hay atletas asociados al club
    const atletasAsociados = await db.collection('registro').find({ 
      clubId: req.params.id, 
      rol: 'atleta' 
    }).toArray();

    if (atletasAsociados.length > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el club porque tiene atletas asociados. Primero desasocia todos los atletas.' 
      });
    }

    const result = await db.collection('club').deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Club no encontrado' });
    }

    res.json({ message: 'Club eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar club:', error);
    res.status(500).json({ error: 'Error al eliminar club', details: error.message });
  }
});

// GET /api/clubes/estadisticas - Obtener estadísticas de clubes
router.get('/estadisticas/generales', async (req, res) => {
  try {
    const db = req.db;
    
    const totalClubes = await db.collection('club').countDocuments();
    const clubesActivos = await db.collection('club').countDocuments({ estado: 'activo' });
    const clubesInactivos = await db.collection('club').countDocuments({ estado: 'inactivo' });
    
    // Contar atletas por club
    const atletasPorClub = await db.collection('registro').aggregate([
      { $match: { rol: 'atleta', clubId: { $exists: true, $ne: null } } },
      { $group: { _id: '$clubId', totalAtletas: { $sum: 1 } } },
      { $lookup: { from: 'club', localField: '_id', foreignField: '_id', as: 'club' } },
      { $unwind: '$club' },
      { $project: { nombreClub: '$club.nombre', totalAtletas: 1 } }
    ]).toArray();

    res.json({
      totalClubes,
      clubesActivos,
      clubesInactivos,
      atletasPorClub
    });
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas', details: error.message });
  }
});

// POST /api/clubes/:id/atletas - Asociar atletas a un club
router.post('/:id/atletas', async (req, res) => {
  try {
    const db = req.db;
    const { atletaIds } = req.body;

    if (!atletaIds || !Array.isArray(atletaIds)) {
      return res.status(400).json({ error: 'Se requiere un array de IDs de atletas' });
    }

    // Verificar que el club existe
    const club = await db.collection('club').findOne({ _id: new ObjectId(req.params.id) });
    if (!club) {
      return res.status(404).json({ error: 'Club no encontrado' });
    }

    // Verificar que todos los atletas existen
    const atletas = await db.collection('registro').find({
      _id: { $in: atletaIds.map(id => new ObjectId(id)) },
      rol: 'atleta'
    }).toArray();

    if (atletas.length !== atletaIds.length) {
      return res.status(400).json({ error: 'Algunos atletas no existen o no son válidos' });
    }

    // Asociar atletas al club
    const result = await db.collection('registro').updateMany(
      { _id: { $in: atletaIds.map(id => new ObjectId(id)) } },
      { $set: { clubId: req.params.id } }
    );

    res.json({ 
      message: `${result.modifiedCount} atletas asociados correctamente al club`,
      atletasAsociados: result.modifiedCount
    });
  } catch (error) {
    console.error('❌ Error al asociar atletas:', error);
    res.status(500).json({ error: 'Error al asociar atletas', details: error.message });
  }
});

// DELETE /api/clubes/:id/atletas/:atletaId - Desasociar un atleta del club
router.delete('/:id/atletas/:atletaId', async (req, res) => {
  try {
    const db = req.db;
    const { atletaId } = req.params;

    // Verificar que el club existe
    const club = await db.collection('club').findOne({ _id: new ObjectId(req.params.id) });
    if (!club) {
      return res.status(404).json({ error: 'Club no encontrado' });
    }

    // Verificar que el atleta existe y está asociado al club
    const atleta = await db.collection('registro').findOne({
      _id: new ObjectId(atletaId),
      clubId: req.params.id,
      rol: 'atleta'
    });

    if (!atleta) {
      return res.status(404).json({ error: 'Atleta no encontrado o no está asociado a este club' });
    }

    // Desasociar atleta del club
    const result = await db.collection('registro').updateOne(
      { _id: new ObjectId(atletaId) },
      { $unset: { clubId: '' } }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ error: 'No se pudo desasociar el atleta' });
    }

    res.json({ message: 'Atleta desasociado correctamente del club' });
  } catch (error) {
    console.error('❌ Error al desasociar atleta:', error);
    res.status(500).json({ error: 'Error al desasociar atleta', details: error.message });
  }
});

module.exports = router;