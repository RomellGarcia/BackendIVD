const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

// GET /api/entrenadores/club/:clubId - Obtener entrenadores asignados a un club
router.get('/club/:clubId', async (req, res) => {
  try {
    const db = req.db;
    const clubId = req.params.clubId;

    // Verificar que el club existe
    const club = await db.collection('club').findOne({ 
      _id: new ObjectId(clubId) 
    });

    if (!club) {
      return res.status(404).json({ error: 'Club no encontrado' });
    }

    // Obtener entrenadores del club
    const entrenadores = await db.collection('registro')
      .find({ 
        clubId: new ObjectId(clubId), 
        rol: 'entrenador' 
      })
      .sort({ nombre: 1, apellidopa: 1 })
      .toArray();

    res.json(entrenadores);

  } catch (error) {
    console.error('Error al obtener entrenadores del club:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/entrenadores/solicitudes-club/:clubId - Obtener solicitudes de entrenadores para un club
router.get('/solicitudes-club/:clubId', async (req, res) => {
  try {
    const db = req.db;
    const clubId = req.params.clubId;

    // Verificar que el club existe
    const club = await db.collection('club').findOne({ 
      _id: new ObjectId(clubId) 
    });

    if (!club) {
      return res.status(404).json({ error: 'Club no encontrado' });
    }

    // Obtener solicitudes de entrenadores para este club
    const solicitudes = await db.collection('solicitudesEntrenadores')
      .find({ clubId: new ObjectId(clubId) })
      .sort({ fechaSolicitud: -1 })
      .toArray();

    res.json(solicitudes);

  } catch (error) {
    console.error('Error al obtener solicitudes de entrenadores:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/entrenadores/solicitudes/:solicitudId - Actualizar estado de solicitud de entrenador
router.put('/solicitudes/:solicitudId', async (req, res) => {
  try {
    const db = req.db;
    const solicitudId = req.params.solicitudId;
    const { estado } = req.body;

    if (!['pendiente', 'aceptada', 'rechazada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    // Obtener la solicitud
    const solicitud = await db.collection('solicitudesEntrenadores').findOne({
      _id: new ObjectId(solicitudId)
    });

    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Actualizar el estado de la solicitud
    await db.collection('solicitudesEntrenadores').updateOne(
      { _id: new ObjectId(solicitudId) },
      { $set: { estado: estado } }
    );

    // Si se acepta la solicitud, asignar el entrenador al club
    if (estado === 'aceptada') {
      await db.collection('registro').updateOne(
        { _id: solicitud.entrenadorId },
        { $set: { clubId: solicitud.clubId } }
      );
    }

    res.json({ message: 'Solicitud actualizada correctamente' });

  } catch (error) {
    console.error('Error al actualizar solicitud de entrenador:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/entrenadores/test - Endpoint de prueba para verificar la colección
router.get('/test', async (req, res) => {
  try {
    const db = req.db;
    
    // Verificar que la colección existe
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('Colecciones disponibles:', collectionNames);
    
    // Intentar crear una solicitud de prueba
    const solicitudPrueba = {
      entrenadorId: new ObjectId('507f1f77bcf86cd799439011'), // ID de prueba
      clubId: new ObjectId('507f1f77bcf86cd799439012'), // ID de prueba
      mensaje: 'Solicitud de prueba',
      estado: 'pendiente',
      fechaSolicitud: new Date(),
      nombreEntrenador: 'Entrenador de Prueba',
      emailEntrenador: 'test@test.com',
      telefonoEntrenador: '1234567890'
    };
    
    try {
      const result = await db.collection('solicitudesEntrenadores').insertOne(solicitudPrueba);
      console.log('Solicitud de prueba creada:', result.insertedId);
      
      // Eliminar la solicitud de prueba
      await db.collection('solicitudesEntrenadores').deleteOne({ _id: result.insertedId });
      console.log('Solicitud de prueba eliminada');
      
      var testResult = 'Colección funciona correctamente';
    } catch (insertError) {
      console.error('Error al crear solicitud de prueba:', insertError);
      var testResult = 'Error al crear solicitud: ' + insertError.message;
    }
    
    // Contar documentos en la colección de solicitudes
    const solicitudesCount = await db.collection('solicitudesEntrenadores').countDocuments();
    
    // Obtener algunas solicitudes de ejemplo
    const solicitudesEjemplo = await db.collection('solicitudesEntrenadores')
      .find({})
      .limit(5)
      .toArray();
    
    res.json({
      message: 'Test completado',
      colecciones: collectionNames,
      solicitudesCount: solicitudesCount,
      solicitudesEjemplo: solicitudesEjemplo,
      testResult: testResult
    });
    
  } catch (error) {
    console.error('Error en test:', error);
    res.status(500).json({ error: 'Error en test', details: error.message });
  }
});

module.exports = router;

