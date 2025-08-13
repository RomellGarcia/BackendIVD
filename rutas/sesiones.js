const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

// Configuración de MongoDB
const url = 'mongodb://localhost:27017';
const dbName = 'pagestadia';

// Crear nueva sesión
router.post('/crear', async (req, res) => {
  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    
    const {
      titulo,
      descripcion,
      fechaInicio,
      duracion,
      tipoEntrenamiento,
      ejercicios,
      intensidad,
      materialNecesario,
      notas,
      entrenadorId,
      clubId,
      atletasAsignados
    } = req.body;

    const sesion = {
      titulo,
      descripcion,
      fechaInicio: new Date(fechaInicio),
      duracion: parseInt(duracion), // en minutos
      tipoEntrenamiento,
      ejercicios: ejercicios || [],
      intensidad,
      materialNecesario: materialNecesario || [],
      notas: notas || '',
      entrenadorId: new ObjectId(entrenadorId),
      clubId: new ObjectId(clubId),
      atletasAsignados: atletasAsignados || [],
      estado: 'programada', // programada, en_curso, completada, cancelada
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    };

    const result = await db.collection('sesiones').insertOne(sesion);
    
    await client.close();
    
    res.status(201).json({
      success: true,
      message: 'Sesión creada exitosamente',
      sesionId: result.insertedId
    });

  } catch (error) {
    console.error('Error al crear sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la sesión',
      error: error.message
    });
  }
});

// Obtener sesiones por entrenador
router.get('/entrenador/:entrenadorId', async (req, res) => {
  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    
    const { entrenadorId } = req.params;
    
    const sesiones = await db.collection('sesiones')
      .find({ entrenadorId: new ObjectId(entrenadorId) })
      .sort({ fechaInicio: 1 })
      .toArray();
    
    await client.close();
    
    res.json({
      success: true,
      sesiones
    });

  } catch (error) {
    console.error('Error al obtener sesiones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las sesiones',
      error: error.message
    });
  }
});

// Obtener sesiones por club
router.get('/club/:clubId', async (req, res) => {
  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    
    const { clubId } = req.params;
    
    const sesiones = await db.collection('sesiones')
      .find({ clubId: new ObjectId(clubId) })
      .sort({ fechaInicio: 1 })
      .toArray();
    
    await client.close();
    
    res.json({
      success: true,
      sesiones
    });

  } catch (error) {
    console.error('Error al obtener sesiones del club:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las sesiones del club',
      error: error.message
    });
  }
});

// Obtener sesiones por atleta
router.get('/atleta/:atletaId', async (req, res) => {
  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    
    const { atletaId } = req.params;
    
    const sesiones = await db.collection('sesiones')
      .find({ atletasAsignados: new ObjectId(atletaId) })
      .sort({ fechaInicio: 1 })
      .toArray();
    
    await client.close();
    
    res.json({
      success: true,
      sesiones
    });

  } catch (error) {
    console.error('Error al obtener sesiones del atleta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las sesiones del atleta',
      error: error.message
    });
  }
});

// Actualizar sesión
router.put('/:sesionId', async (req, res) => {
  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    
    const { sesionId } = req.params;
    const updateData = {
      ...req.body,
      fechaActualizacion: new Date()
    };
    
    // Convertir IDs si están presentes
    if (updateData.entrenadorId) {
      updateData.entrenadorId = new ObjectId(updateData.entrenadorId);
    }
    if (updateData.clubId) {
      updateData.clubId = new ObjectId(updateData.clubId);
    }
    if (updateData.fechaInicio) {
      updateData.fechaInicio = new Date(updateData.fechaInicio);
    }
    
    const result = await db.collection('sesiones').updateOne(
      { _id: new ObjectId(sesionId) },
      { $set: updateData }
    );
    
    await client.close();
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Sesión actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error al actualizar sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la sesión',
      error: error.message
    });
  }
});

// Eliminar sesión
router.delete('/:sesionId', async (req, res) => {
  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    
    const { sesionId } = req.params;
    
    const result = await db.collection('sesiones').deleteOne({
      _id: new ObjectId(sesionId)
    });
    
    await client.close();
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Sesión eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la sesión',
      error: error.message
    });
  }
});

// Obtener una sesión específica
router.get('/:sesionId', async (req, res) => {
  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    
    const { sesionId } = req.params;
    
    const sesion = await db.collection('sesiones').findOne({
      _id: new ObjectId(sesionId)
    });
    
    await client.close();
    
    if (!sesion) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }
    
    res.json({
      success: true,
      sesion
    });

  } catch (error) {
    console.error('Error al obtener sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la sesión',
      error: error.message
    });
  }
});

module.exports = router;
