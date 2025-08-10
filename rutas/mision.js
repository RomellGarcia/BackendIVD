// rutas/mision.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Middleware para asegurar que req.db esté disponible
router.use((req, res, next) => {
  if (!req.db) {
    return res.status(500).json({ message: 'Error interno: Base de datos no disponible' });
  }
  next();
});

// GET all missions
router.get('/', async (req, res) => {
  try {
    const misiones = await req.db.collection('mision').find().sort({ createdAt: -1 }).toArray();
    res.json(misiones);
  } catch (error) {
    console.error('❌ Error al obtener las misiones:', error);
    res.status(500).json({ message: 'Error al obtener las misiones', error: error.message });
  }
});

// GET a mission by ID
router.get('/:id', async (req, res) => {
  try {
    const mision = await req.db.collection('mision').findOne({ _id: new ObjectId(req.params.id) });
    if (!mision) {
      return res.status(404).json({ message: 'Misión no encontrada' });
    }
    res.json(mision);
  } catch (error) {
    console.error('❌ Error al obtener la misión:', error);
    res.status(500).json({ message: 'Error al obtener la misión', error: error.message });
  }
});

// POST a new mission
router.post('/', async (req, res) => {
  try {
    const { titulo, contenido } = req.body;
    if (!titulo || !contenido) {
      return res.status(400).json({ message: 'Título y contenido son requeridos' });
    }
    if (titulo.length > 255) {
      return res.status(400).json({ message: 'El título no debe exceder 255 caracteres' });
    }
    
    // Eliminar todas las misiones existentes antes de crear una nueva
    await req.db.collection('mision').deleteMany({});
    
    const nuevaMision = {
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await req.db.collection('mision').insertOne(nuevaMision);
    const misionGuardada = await req.db.collection('mision').findOne({ _id: result.insertedId });
    res.status(201).json(misionGuardada);
  } catch (error) {
    console.error('❌ Error al crear la misión:', error);
    res.status(500).json({ message: 'Error al crear la misión', error: error.message });
  }
});

// PUT update a mission by ID
router.put('/:id', async (req, res) => {
  try {
    const { titulo, contenido } = req.body;
    if (!titulo || !contenido) {
      return res.status(400).json({ message: 'Título y contenido son requeridos' });
    }
    if (titulo.length > 255) {
      return res.status(400).json({ message: 'El título no debe exceder 255 caracteres' });
    }
    const misionId = new ObjectId(req.params.id);
    const updateData = {
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      updatedAt: new Date(),
    };
    
    // Primero verificar si la misión existe
    const misionExistente = await req.db.collection('mision').findOne({ _id: misionId });
    if (!misionExistente) {
      return res.status(404).json({ message: 'Misión no encontrada' });
    }
    
    // Actualizar la misión
    const result = await req.db.collection('mision').findOneAndUpdate(
      { _id: misionId },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    res.json(result.value);
  } catch (error) {
    console.error('❌ Error al actualizar la misión:', error);
    if (error.name === 'MongoInvalidArgumentError' || error.name === 'BSONError') {
      return res.status(400).json({ message: 'ID inválido', error: error.message });
    }
    res.status(500).json({ message: 'Error al actualizar la misión', error: error.message });
  }
});

// DELETE a mission by ID
router.delete('/:id', async (req, res) => {
  try {
    const misionId = new ObjectId(req.params.id);
    const result = await req.db.collection('mision').findOneAndDelete({ _id: misionId });
    if (!result.value) {
      return res.status(404).json({ message: 'Misión no encontrada' });
    }
    res.json({ message: 'Misión eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar la misión:', error);
    if (error.name === 'MongoInvalidArgumentError' || error.name === 'BSONError') {
      return res.status(400).json({ message: 'ID inválido', error: error.message });
    }
    res.status(500).json({ message: 'Error al eliminar la misión', error: error.message });
  }
});

module.exports = router;