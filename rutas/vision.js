// rutas/vision.js
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

// GET /api/vision - Obtener las visiones
router.get('/', async (req, res) => {
  try {
    const visiones = await req.db.collection('vision').find().sort({ createdAt: -1 }).toArray();
    res.json(visiones);
  } catch (error) {
    console.error('❌ Error al obtener las visiones:', error);
    res.status(500).json({ message: 'Error al obtener las visiones', error: error.message });
  }
});

// GET /api/vision/:id - Obtener una visión por ID
router.get('/:id', async (req, res) => {
  try {
    const vision = await req.db.collection('vision').findOne({ _id: new ObjectId(req.params.id) });
    if (!vision) {
      return res.status(404).json({ message: 'Visión no encontrada' });
    }
    res.json(vision);
  } catch (error) {
    console.error('❌ Error al obtener la visión:', error);
    res.status(500).json({ message: 'Error al obtener la visión', error: error.message });
  }
});

// POST /api/vision - Crear una nueva visión
router.post('/', async (req, res) => {
  try {
    const { titulo, contenido } = req.body;
    if (!titulo || !contenido) {
      return res.status(400).json({ message: 'Título y contenido son requeridos' });
    }
    if (titulo.length > 255) {
      return res.status(400).json({ message: 'El título no debe exceder 255 caracteres' });
    }
    if (contenido.length > 2000) {
      return res.status(400).json({ message: 'El contenido no debe exceder 2000 caracteres' });
    }
    
    // Eliminar todas las visiones existentes antes de crear una nueva
    await req.db.collection('vision').deleteMany({});
    
    const nuevaVision = {
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await req.db.collection('vision').insertOne(nuevaVision);
    const visionGuardada = await req.db.collection('vision').findOne({ _id: result.insertedId });
    res.status(201).json(visionGuardada);
  } catch (error) {
    console.error('❌ Error al crear la visión:', error);
    res.status(500).json({ message: 'Error al crear la visión', error: error.message });
  }
});

// PUT /api/vision/:id - Actualizar una visión
router.put('/:id', async (req, res) => {
  try {
    const { titulo, contenido } = req.body;
    if (!titulo || !contenido) {
      return res.status(400).json({ message: 'Título y contenido son requeridos' });
    }
    if (titulo.length > 255) {
      return res.status(400).json({ message: 'El título no debe exceder 255 caracteres' });
    }
    if (contenido.length > 2000) {
      return res.status(400).json({ message: 'El contenido no debe exceder 2000 caracteres' });
    }
    const visionId = new ObjectId(req.params.id);
    const updateData = {
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      updatedAt: new Date(),
    };
    const result = await req.db.collection('vision').findOneAndUpdate(
      { _id: visionId },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    if (!result.value) {
      return res.status(404).json({ message: 'Visión no encontrada' });
    }
    res.json(result.value);
  } catch (error) {
    console.error('❌ Error al actualizar la visión:', error);
    if (error.name === 'MongoInvalidArgumentError' || error.name === 'BSONError') {
      return res.status(400).json({ message: 'ID inválido', error: error.message });
    }
    res.status(500).json({ message: 'Error al actualizar la visión', error: error.message });
  }
});

// DELETE /api/vision/:id - Eliminar una visión
router.delete('/:id', async (req, res) => {
  try {
    const visionId = new ObjectId(req.params.id);
    const result = await req.db.collection('vision').findOneAndDelete({ _id: visionId });
    if (!result.value) {
      return res.status(404).json({ message: 'Visión no encontrada' });
    }
    res.json({ message: 'Visión eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar la visión:', error);
    if (error.name === 'MongoInvalidArgumentError' || error.name === 'BSONError') {
      return res.status(400).json({ message: 'ID inválido', error: error.message });
    }
    res.status(500).json({ message: 'Error al eliminar la visión', error: error.message });
  }
});

module.exports = router;