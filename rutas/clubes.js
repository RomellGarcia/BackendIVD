const express = require('express');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const router = express.Router();
const saltRounds = 10;

// POST /api/clubes - Registrar un club
router.post('/', async (req, res) => {
  const { nombre, telefono, gmail, password, rol } = req.body;

  // Validación de campos obligatorios para un club
  if (!nombre || !telefono || !gmail || !password || !rol) {
    return res.status(400).json({ error: 'Los campos nombre, teléfono, correo, contraseña y rol son obligatorios' });
  }

  try {
    const db = req.db;

    // Validar correo único en la colección 'club'
    const correoExistente = await db.collection('club').findOne({ gmail });
    if (correoExistente) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    const nuevoClub = {
      nombre,
      telefono,
      gmail,
      password: await bcrypt.hash(password, saltRounds),
      rol,
      fechaRegistro: new Date(),
    };

    const result = await db.collection('club').insertOne(nuevoClub);

    if (result.insertedId) {
      res.status(201).json({
        message: 'Club registrado exitosamente',
        club: { ...nuevoClub, _id: result.insertedId },
      });
    } else {
      throw new Error('Fallo al insertar el club en la base de datos');
    }
  } catch (error) {
    console.error('❌ Error al crear el club:', error);
    res.status(500).json({
      error: 'No se pudo registrar el club',
      details: error.message,
    });
  }
});

// GET /api/clubes/:id - Obtener datos de un club por su id
router.get('/:id', async (req, res) => {
  try {
    const db = req.db;
    const club = await db.collection('club').findOne({ _id: new ObjectId(req.params.id) });
    if (!club) return res.status(404).json({ error: 'Club no encontrado' });
    res.json(club);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener club', details: error.message });
  }
});

// PUT /api/clubes/:id - Actualizar datos de un club por su id
router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    const { nombre, gmail, telefono } = req.body;
    if (!nombre || !gmail || !telefono) {
      return res.status(400).json({ error: 'Nombre, correo y teléfono son obligatorios' });
    }
    const result = await db.collection('club').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { nombre, gmail, telefono } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Club no encontrado' });
    res.json({ message: 'Club actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar club', details: error.message });
  }
});

module.exports = router;