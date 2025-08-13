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

// POST /api/resultados - Crear nuevo resultado
router.post('/', async (req, res) => {
  try {
    const {
      eventoId,
      convocatoriaIndex,
      atletaId,
      categoria,
      sexo,
      municipio,
      club,
      añoCompetitivo,
      pruebas,
      entrenadorId,
      lugarEntrenamiento
    } = req.body;

    // Validaciones básicas
    if (!eventoId || !atletaId || !categoria) {
      return res.status(400).json({ message: 'Evento, atleta y categoría son obligatorios' });
    }

    const db = req.db;

    // Verificar que el evento existe
    const evento = await db.collection('eventos').findOne({ _id: new ObjectId(eventoId) });
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    // Verificar que el atleta existe
    const atleta = await db.collection('registro').findOne({ _id: new ObjectId(atletaId), rol: 'atleta' });
    if (!atleta) {
      return res.status(404).json({ message: 'Atleta no encontrado' });
    }

    // Verificar que el entrenador existe si se especifica
    if (entrenadorId) {
      const entrenador = await db.collection('registro').findOne({ _id: new ObjectId(entrenadorId), rol: 'entrenador' });
      if (!entrenador) {
        return res.status(404).json({ message: 'Entrenador no encontrado' });
      }
    }

    // Crear el resultado
    const nuevoResultado = {
      eventoId,
      convocatoriaIndex: convocatoriaIndex || 0,
      atletaId,
      categoria,
      sexo: sexo || 'no especificado',
      municipio: municipio || '',
      club: club || '',
      añoCompetitivo: añoCompetitivo || new Date().getFullYear(),
      pruebas: pruebas || [],
      entrenadorId: entrenadorId || null,
      lugarEntrenamiento: lugarEntrenamiento || '',
      fechaRegistro: new Date(),
      nombreAtleta: `${atleta.nombre} ${atleta.apellidopa} ${atleta.apellidoma}`,
      nombreEvento: evento.titulo,
      fechaEvento: evento.fecha
    };

    const result = await db.collection('resultados').insertOne(nuevoResultado);
    const resultadoGuardado = await db.collection('resultados').findOne({ _id: result.insertedId });

    res.status(201).json(resultadoGuardado);
  } catch (error) {
    console.error('❌ Error al crear resultado:', error);
    res.status(500).json({ message: 'Error al crear resultado', error: error.message });
  }
});

// GET /api/resultados - Obtener resultados con filtros
router.get('/', async (req, res) => {
  try {
    const {
      eventoId,
      atletaId,
      categoria,
      club,
      añoCompetitivo,
      limit = 100
    } = req.query;

    const db = req.db;
    let filtro = {};

    // Aplicar filtros si se proporcionan
    if (eventoId) filtro.eventoId = eventoId;
    if (atletaId) filtro.atletaId = atletaId;
    if (categoria) filtro.categoria = categoria;
    if (club) filtro.club = club;
    if (añoCompetitivo) filtro.añoCompetitivo = parseInt(añoCompetitivo);

    const resultados = await db.collection('resultados')
      .find(filtro)
      .sort({ fechaRegistro: -1 })
      .limit(parseInt(limit))
      .toArray();

    res.json(resultados);
  } catch (error) {
    console.error('❌ Error al obtener resultados:', error);
    res.status(500).json({ message: 'Error al obtener resultados', error: error.message });
  }
});

// GET /api/resultados/:id - Obtener resultado específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.db;

    const resultado = await db.collection('resultados').findOne({ _id: new ObjectId(id) });
    if (!resultado) {
      return res.status(404).json({ message: 'Resultado no encontrado' });
    }

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error al obtener resultado:', error);
    res.status(500).json({ message: 'Error al obtener resultado', error: error.message });
  }
});

// PUT /api/resultados/:id - Actualizar resultado
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      eventoId,
      convocatoriaIndex,
      atletaId,
      categoria,
      sexo,
      municipio,
      club,
      añoCompetitivo,
      pruebas,
      entrenadorId,
      lugarEntrenamiento
    } = req.body;

    const db = req.db;

    // Verificar que el resultado existe
    const resultadoExistente = await db.collection('resultados').findOne({ _id: new ObjectId(id) });
    if (!resultadoExistente) {
      return res.status(404).json({ message: 'Resultado no encontrado' });
    }

    // Verificar que el evento existe si se está cambiando
    if (eventoId && eventoId !== resultadoExistente.eventoId) {
      const evento = await db.collection('eventos').findOne({ _id: new ObjectId(eventoId) });
      if (!evento) {
        return res.status(404).json({ message: 'Evento no encontrado' });
      }
    }

    // Verificar que el atleta existe si se está cambiando
    if (atletaId && atletaId !== resultadoExistente.atletaId) {
      const atleta = await db.collection('registro').findOne({ _id: new ObjectId(atletaId), rol: 'atleta' });
      if (!atleta) {
        return res.status(404).json({ message: 'Atleta no encontrado' });
      }
    }

    // Verificar que el entrenador existe si se está cambiando
    if (entrenadorId && entrenadorId !== resultadoExistente.entrenadorId) {
      const entrenador = await db.collection('registro').findOne({ _id: new ObjectId(entrenadorId), rol: 'entrenador' });
      if (!entrenador) {
        return res.status(404).json({ message: 'Entrenador no encontrado' });
      }
    }

    // Preparar datos de actualización
    const datosActualizados = {
      eventoId: eventoId || resultadoExistente.eventoId,
      convocatoriaIndex: convocatoriaIndex !== undefined ? convocatoriaIndex : resultadoExistente.convocatoriaIndex,
      atletaId: atletaId || resultadoExistente.atletaId,
      categoria: categoria || resultadoExistente.categoria,
      sexo: sexo || resultadoExistente.sexo,
      municipio: municipio !== undefined ? municipio : resultadoExistente.municipio,
      club: club !== undefined ? club : resultadoExistente.club,
      añoCompetitivo: añoCompetitivo || resultadoExistente.añoCompetitivo,
      pruebas: pruebas || resultadoExistente.pruebas,
      entrenadorId: entrenadorId !== undefined ? entrenadorId : resultadoExistente.entrenadorId,
      lugarEntrenamiento: lugarEntrenamiento !== undefined ? lugarEntrenamiento : resultadoExistente.lugarEntrenamiento,
      fechaActualizacion: new Date()
    };

    // Actualizar el resultado
    const result = await db.collection('resultados').updateOne(
      { _id: new ObjectId(id) },
      { $set: datosActualizados }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Resultado no encontrado' });
    }

    // Obtener el resultado actualizado
    const resultadoActualizado = await db.collection('resultados').findOne({ _id: new ObjectId(id) });
    res.json(resultadoActualizado);
  } catch (error) {
    console.error('❌ Error al actualizar resultado:', error);
    res.status(500).json({ message: 'Error al actualizar resultado', error: error.message });
  }
});

// DELETE /api/resultados/:id - Eliminar resultado
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.db;

    const result = await db.collection('resultados').deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Resultado no encontrado' });
    }

    res.json({ message: 'Resultado eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar resultado:', error);
    res.status(500).json({ message: 'Error al eliminar resultado', error: error.message });
  }
});

// GET /api/resultados/evento/:eventoId - Obtener resultados por evento
router.get('/evento/:eventoId', async (req, res) => {
  try {
    const { eventoId } = req.params;
    const db = req.db;

    const resultados = await db.collection('resultados')
      .find({ eventoId })
      .sort({ fechaRegistro: -1 })
      .toArray();

    res.json(resultados);
  } catch (error) {
    console.error('❌ Error al obtener resultados del evento:', error);
    res.status(500).json({ message: 'Error al obtener resultados del evento', error: error.message });
  }
});

// GET /api/resultados/atleta/:atletaId - Obtener resultados por atleta
router.get('/atleta/:atletaId', async (req, res) => {
  try {
    const { atletaId } = req.params;
    const db = req.db;

    const resultados = await db.collection('resultados')
      .find({ atletaId })
      .sort({ fechaRegistro: -1 })
      .toArray();

    res.json(resultados);
  } catch (error) {
    console.error('❌ Error al obtener resultados del atleta:', error);
    res.status(500).json({ message: 'Error al obtener resultados del atleta', error: error.message });
  }
});

// GET /api/resultados/debug/clubes - Endpoint temporal para debug
router.get('/debug/clubes', async (req, res) => {
  try {
    const db = req.db;
    
    console.log('🔍 Debug: Obteniendo todos los clubes...');
    
    // Obtener todos los clubes (colección 'club', no 'clubes')
    const clubes = await db.collection('club').find({}).toArray();
    console.log('📊 Clubes encontrados:', clubes.length);
    clubes.forEach(club => {
      console.log(`  - ID: ${club._id}, Nombre: "${club.nombre}"`);
    });
    
    // Obtener todos los resultados
    const resultados = await db.collection('resultados').find({}).toArray();
    console.log('📊 Resultados encontrados:', resultados.length);
    resultados.forEach(resultado => {
      console.log(`  - Club: "${resultado.club}", Atleta: ${resultado.nombreAtleta}`);
    });
    
    res.json({
      clubes: clubes,
      resultados: resultados,
      totalClubes: clubes.length,
      totalResultados: resultados.length
    });
  } catch (error) {
    console.error('❌ Error en debug:', error);
    res.status(500).json({ message: 'Error en debug', error: error.message });
  }
});

// GET /api/resultados/club/:clubId - Obtener resultados por club
router.get('/club/:clubId', async (req, res) => {
  try {
    const { clubId } = req.params;
    const db = req.db;

    console.log('🔍 Buscando club con ID:', clubId);

    // Primero obtener el nombre del club (colección 'club', no 'clubes')
    const club = await db.collection('club').findOne({ _id: new ObjectId(clubId) });
    if (!club) {
      console.log('❌ Club no encontrado con ID:', clubId);
      return res.status(404).json({ message: 'Club no encontrado' });
    }

    console.log('✅ Club encontrado:', club.nombre);

    // Buscar resultados por el nombre del club O por ID del club
    const resultados = await db.collection('resultados')
      .find({ 
        $or: [
          { club: club.nombre },
          { clubId: clubId }
        ]
      })
      .sort({ fechaRegistro: -1 })
      .toArray();

    console.log('📊 Resultados encontrados para el club:', resultados.length);
    console.log('📊 Primer resultado:', resultados[0]);

    res.json(resultados);
  } catch (error) {
    console.error('❌ Error al obtener resultados del club:', error);
    res.status(500).json({ message: 'Error al obtener resultados del club', error: error.message });
  }
});

// GET /api/resultados/entrenador/:entrenadorId - Obtener resultados por entrenador
router.get('/entrenador/:entrenadorId', async (req, res) => {
  try {
    const { entrenadorId } = req.params;
    const db = req.db;

    console.log('🔍 Buscando entrenador con ID:', entrenadorId);

    // Verificar que el entrenador existe
    const entrenador = await db.collection('registro').findOne({ 
      _id: new ObjectId(entrenadorId), 
      rol: 'entrenador' 
    });
    
    if (!entrenador) {
      console.log('❌ Entrenador no encontrado con ID:', entrenadorId);
      return res.status(404).json({ message: 'Entrenador no encontrado' });
    }

    console.log('✅ Entrenador encontrado:', `${entrenador.nombre} ${entrenador.apellidopa}`);

    // Buscar resultados por entrenadorId
    const resultados = await db.collection('resultados')
      .find({ entrenadorId: entrenadorId })
      .sort({ fechaRegistro: -1 })
      .toArray();

    console.log('📊 Resultados encontrados para el entrenador:', resultados.length);
    if (resultados.length > 0) {
      console.log('📊 Primer resultado:', resultados[0]);
    }

    res.json(resultados);
  } catch (error) {
    console.error('❌ Error al obtener resultados del entrenador:', error);
    res.status(500).json({ message: 'Error al obtener resultados del entrenador', error: error.message });
  }
});

// GET /api/resultados/estadisticas/generales - Obtener estadísticas generales
router.get('/estadisticas/generales', async (req, res) => {
  try {
    const db = req.db;

    const pipeline = [
      {
        $group: {
          _id: null,
          totalResultados: { $sum: 1 },
          totalEventos: { $addToSet: '$eventoId' },
          totalAtletas: { $addToSet: '$atletaId' },
          totalClubes: { $addToSet: '$club' },
          categorias: { $addToSet: '$categoria' }
        }
      },
      {
        $project: {
          _id: 0,
          totalResultados: 1,
          totalEventos: { $size: '$totalEventos' },
          totalAtletas: { $size: '$totalAtletas' },
          totalClubes: { $size: '$totalClubes' },
          categorias: 1
        }
      }
    ];

    const estadisticas = await db.collection('resultados').aggregate(pipeline).toArray();
    res.json(estadisticas[0] || {});
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
  }
});

// GET /api/resultados/estadisticas/club/:clubId - Obtener estadísticas por club
router.get('/estadisticas/club/:clubId', async (req, res) => {
  try {
    const { clubId } = req.params;
    const db = req.db;

    // Obtener el nombre del club (colección 'club', no 'clubes')
    const club = await db.collection('club').findOne({ _id: new ObjectId(clubId) });
    if (!club) {
      return res.status(404).json({ message: 'Club no encontrado' });
    }

    const pipeline = [
      { $match: { club: club.nombre } },
      {
        $group: {
          _id: null,
          totalResultados: { $sum: 1 },
          totalAtletas: { $addToSet: '$atletaId' },
          categorias: { $addToSet: '$categoria' },
          eventos: { $addToSet: '$eventoId' }
        }
      },
      {
        $project: {
          _id: 0,
          totalResultados: 1,
          totalAtletas: { $size: '$totalAtletas' },
          categorias: 1,
          totalEventos: { $size: '$eventos' }
        }
      }
    ];

    const estadisticas = await db.collection('resultados').aggregate(pipeline).toArray();
    res.json(estadisticas[0] || {});
  } catch (error) {
    console.error('❌ Error al obtener estadísticas del club:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas del club', error: error.message });
  }
});

module.exports = router; 