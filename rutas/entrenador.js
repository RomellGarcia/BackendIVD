const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

// GET /api/entrenador/stats/:id - Obtener estadísticas del entrenador
router.get('/stats/:id', async (req, res) => {
  try {
    const db = req.db;
    const entrenadorId = req.params.id;

    // Verificar que el entrenador existe
    const entrenador = await db.collection('registro').findOne({ 
      _id: new ObjectId(entrenadorId), 
      rol: 'entrenador' 
    });

    if (!entrenador) {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    // Obtener atletas asignados al club del entrenador
    let atletas = [];
    if (entrenador.clubId) {
      atletas = await db.collection('registro').find({ 
        clubId: entrenador.clubId, 
        rol: 'atleta' 
      }).toArray();
    }

    // Contar atletas activos (por defecto todos están activos)
    const atletasActivos = atletas.length;

    // Contar eventos próximos (eventos futuros)
    const eventosProximos = await db.collection('eventos').countDocuments({
      fecha: { $gte: new Date() }
    });

    // Contar sesiones este mes (placeholder - se implementará cuando se agregue la funcionalidad de sesiones)
    const sesionesEsteMes = 0; // TODO: Implementar cuando se agregue la colección de sesiones

    res.json({
      totalAtletas: atletas.length,
      atletasActivos: atletasActivos,
      eventosProximos: eventosProximos,
      sesionesEsteMes: sesionesEsteMes
    });

  } catch (error) {
    console.error('Error al obtener estadísticas del entrenador:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/entrenador/activity/:id - Obtener actividad reciente del entrenador
router.get('/activity/:id', async (req, res) => {
  try {
    const db = req.db;
    const entrenadorId = req.params.id;

    // Verificar que el entrenador existe
    const entrenador = await db.collection('registro').findOne({ 
      _id: new ObjectId(entrenadorId), 
      rol: 'entrenador' 
    });

    if (!entrenador) {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    // Obtener eventos próximos como actividad
    const eventos = await db.collection('eventos')
      .find({ fecha: { $gte: new Date() } })
      .sort({ fecha: 1 })
      .limit(5)
      .toArray();

    // Convertir eventos a formato de actividad
    const actividad = eventos.map(evento => ({
      tipo: 'evento',
      titulo: evento.nombre,
      descripcion: `Evento: ${evento.nombre} - ${evento.lugar}`,
      fecha: evento.fecha
    }));

    // TODO: Agregar sesiones de entrenamiento cuando se implemente esa funcionalidad
    // const sesiones = await db.collection('sesiones')
    //   .find({ entrenadorId: new ObjectId(entrenadorId) })
    //   .sort({ fecha: -1 })
    //   .limit(5)
    //   .toArray();

    // Ordenar por fecha (más reciente primero)
    actividad.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(actividad);

  } catch (error) {
    console.error('Error al obtener actividad del entrenador:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/entrenador/atletas/:id - Obtener atletas asignados al entrenador
router.get('/atletas/:id', async (req, res) => {
  try {
    const db = req.db;
    const entrenadorId = req.params.id;

    console.log('Buscando atletas para entrenador:', entrenadorId);

    // Verificar que el entrenador existe
    const entrenador = await db.collection('registro').findOne({ 
      _id: new ObjectId(entrenadorId), 
      rol: 'entrenador' 
    });

    if (!entrenador) {
      console.log('Entrenador no encontrado:', entrenadorId);
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    console.log('Entrenador encontrado:', {
      nombre: entrenador.nombre,
      clubId: entrenador.clubId,
      tipoClubId: typeof entrenador.clubId,
      rol: entrenador.rol
    });

    // Si el entrenador no está asignado a un club, no tiene atletas
    if (!entrenador.clubId) {
      console.log('Entrenador no tiene club asignado');
      return res.json([]);
    }

    console.log('Buscando atletas en club:', entrenador.clubId);

    // ESTRATEGIA SIMPLIFICADA: Obtener todos los atletas y filtrar por clubId
    console.log('Usando estrategia simplificada...');
    
    // Obtener todos los atletas
    const todosLosAtletas = await db.collection('registro')
      .find({ rol: 'atleta' })
      .toArray();
    
    console.log('Total de atletas encontrados:', todosLosAtletas.length);
    
    // Convertir el clubId del entrenador a string para comparación
    const clubIdEntrenador = entrenador.clubId.toString();
    console.log('ClubId del entrenador como string:', clubIdEntrenador);
    
    // Filtrar atletas que tengan el mismo clubId
    atletas = todosLosAtletas.filter(atleta => {
      if (!atleta.clubId) return false;
      
      const clubIdAtleta = atleta.clubId.toString();
      const coincide = clubIdAtleta === clubIdEntrenador;
      
      console.log(`Atleta ${atleta.nombre}: clubId=${clubIdAtleta}, coincide=${coincide}`);
      
      return coincide;
    });
    
    console.log('Atletas filtrados por clubId:', atletas.length);

    console.log('Atletas finales encontrados:', atletas.length);
    console.log('Atletas:', atletas.map(a => ({ 
      nombre: a.nombre, 
      apellido: a.apellidopa, 
      clubId: a.clubId,
      tipoClubId: typeof a.clubId
    })));

    res.json(atletas);

  } catch (error) {
    console.error('Error al obtener atletas del entrenador:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// GET /api/entrenador/debug/:id - Endpoint de depuración para entrenador
router.get('/debug/:id', async (req, res) => {
  try {
    const db = req.db;
    const entrenadorId = req.params.id;

    console.log('Debug: Buscando entrenador:', entrenadorId);

    // Verificar que el entrenador existe
    const entrenador = await db.collection('registro').findOne({ 
      _id: new ObjectId(entrenadorId), 
      rol: 'entrenador' 
    });

    if (!entrenador) {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    let clubInfo = null;
    let atletasEnClub = [];

    if (entrenador.clubId) {
      // Obtener información del club
      clubInfo = await db.collection('club').findOne({ 
        _id: new ObjectId(entrenador.clubId) 
      });

      // Obtener atletas del club
      atletasEnClub = await db.collection('registro')
        .find({ 
          clubId: entrenador.clubId, 
          rol: 'atleta' 
        })
        .toArray();
    }

    // Obtener todos los atletas para comparar
    const todosLosAtletas = await db.collection('registro')
      .find({ rol: 'atleta' })
      .toArray();

    res.json({
      entrenador: {
        id: entrenador._id,
        nombre: `${entrenador.nombre} ${entrenador.apellidopa} ${entrenador.apellidoma}`,
        clubId: entrenador.clubId,
        rol: entrenador.rol
      },
      club: clubInfo ? {
        id: clubInfo._id,
        nombre: clubInfo.nombre,
        email: clubInfo.email
      } : null,
      atletasEnClub: atletasEnClub.length,
      atletasEnClubDetalle: atletasEnClub.map(a => ({
        id: a._id,
        nombre: `${a.nombre} ${a.apellidopa}`,
        clubId: a.clubId
      })),
      totalAtletas: todosLosAtletas.length,
      todosLosAtletas: todosLosAtletas.map(a => ({
        id: a._id,
        nombre: `${a.nombre} ${a.apellidopa}`,
        clubId: a.clubId
      }))
    });

  } catch (error) {
    console.error('Error en debug:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// GET /api/entrenador/verificar-relacion/:id - Verificar relación entrenador-atletas
router.get('/verificar-relacion/:id', async (req, res) => {
  try {
    const db = req.db;
    const entrenadorId = req.params.id;

    console.log('Verificando relación para entrenador:', entrenadorId);

    // Obtener el entrenador
    const entrenador = await db.collection('registro').findOne({ 
      _id: new ObjectId(entrenadorId), 
      rol: 'entrenador' 
    });

    if (!entrenador) {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    // Obtener todos los atletas
    const todosLosAtletas = await db.collection('registro')
      .find({ rol: 'atleta' })
      .toArray();

    // Obtener todos los clubes
    const todosLosClubes = await db.collection('club')
      .find({})
      .toArray();

    // Analizar la relación
    const clubIdEntrenador = entrenador.clubId ? entrenador.clubId.toString() : null;
    
    const atletasConClub = todosLosAtletas.filter(a => a.clubId);
    const atletasSinClub = todosLosAtletas.filter(a => !a.clubId);
    
    const atletasMismoClub = atletasConClub.filter(a => 
      a.clubId.toString() === clubIdEntrenador
    );

    res.json({
      entrenador: {
        id: entrenador._id,
        nombre: `${entrenador.nombre} ${entrenador.apellidopa}`,
        clubId: entrenador.clubId,
        clubIdString: clubIdEntrenador,
        tipoClubId: typeof entrenador.clubId
      },
      estadisticas: {
        totalAtletas: todosLosAtletas.length,
        atletasConClub: atletasConClub.length,
        atletasSinClub: atletasSinClub.length,
        atletasMismoClub: atletasMismoClub.length,
        totalClubes: todosLosClubes.length
      },
      atletasMismoClub: atletasMismoClub.map(a => ({
        id: a._id,
        nombre: `${a.nombre} ${a.apellidopa}`,
        clubId: a.clubId,
        clubIdString: a.clubId ? a.clubId.toString() : null,
        tipoClubId: typeof a.clubId
      })),
      todosLosAtletas: todosLosAtletas.map(a => ({
        id: a._id,
        nombre: `${a.nombre} ${a.apellidopa}`,
        clubId: a.clubId,
        clubIdString: a.clubId ? a.clubId.toString() : null,
        tipoClubId: typeof a.clubId,
        mismoClub: a.clubId ? a.clubId.toString() === clubIdEntrenador : false
      })),
      clubes: todosLosClubes.map(c => ({
        id: c._id,
        nombre: c.nombre,
        idString: c._id.toString()
      }))
    });

  } catch (error) {
    console.error('Error al verificar relación:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// GET /api/entrenador/verificar-estructura - Verificar estructura de la base de datos
router.get('/verificar-estructura', async (req, res) => {
  try {
    const db = req.db;
    
    // Obtener todos los entrenadores
    const entrenadores = await db.collection('registro')
      .find({ rol: 'entrenador' })
      .toArray();
    
    // Obtener todos los atletas
    const atletas = await db.collection('registro')
      .find({ rol: 'atleta' })
      .toArray();
    
    // Obtener todos los clubes
    const clubes = await db.collection('club')
      .find({})
      .toArray();
    
    // Analizar la estructura
    const entrenadoresConClub = entrenadores.filter(e => e.clubId);
    const atletasConClub = atletas.filter(a => a.clubId);
    
    res.json({
      totalEntrenadores: entrenadores.length,
      entrenadoresConClub: entrenadoresConClub.length,
      totalAtletas: atletas.length,
      atletasConClub: atletasConClub.length,
      totalClubes: clubes.length,
      entrenadores: entrenadores.map(e => ({
        id: e._id,
        nombre: `${e.nombre} ${e.apellidopa}`,
        clubId: e.clubId,
        tieneClub: !!e.clubId
      })),
      atletas: atletas.map(a => ({
        id: a._id,
        nombre: `${a.nombre} ${a.apellidopa}`,
        clubId: a.clubId,
        tieneClub: !!a.clubId
      })),
      clubes: clubes.map(c => ({
        id: c._id,
        nombre: c.nombre
      }))
    });
    
  } catch (error) {
    console.error('Error al verificar estructura:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// POST /api/entrenador/verificar-datos - Verificar datos antes de enviar solicitud
router.post('/verificar-datos', async (req, res) => {
  try {
    const db = req.db;
    const { entrenadorId, clubId } = req.body;

    console.log('Verificando datos:', { entrenadorId, clubId });

    // Verificar que el entrenador existe
    const entrenador = await db.collection('registro').findOne({ 
      _id: new ObjectId(entrenadorId), 
      rol: 'entrenador' 
    });

    if (!entrenador) {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    // Verificar que el club existe
    const club = await db.collection('club').findOne({ 
      _id: new ObjectId(clubId) 
    });

    if (!club) {
      return res.status(404).json({ error: 'Club no encontrado' });
    }

    res.json({
      message: 'Datos verificados correctamente',
      entrenador: {
        id: entrenador._id,
        nombre: `${entrenador.nombre} ${entrenador.apellidopa} ${entrenador.apellidoma}`,
        email: entrenador.gmail,
        telefono: entrenador.telefono
      },
      club: {
        id: club._id,
        nombre: club.nombre,
        email: club.email
      }
    });

  } catch (error) {
    console.error('Error al verificar datos:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// POST /api/entrenador/solicitar-club - Enviar solicitud para unirse a un club
router.post('/solicitar-club', async (req, res) => {
  try {
    const db = req.db;
    const { entrenadorId, clubId, mensaje } = req.body;

    console.log('Datos recibidos:', { entrenadorId, clubId, mensaje });

    // Verificar que el entrenador existe
    const entrenador = await db.collection('registro').findOne({ 
      _id: new ObjectId(entrenadorId), 
      rol: 'entrenador' 
    });

    if (!entrenador) {
      console.log('Entrenador no encontrado:', entrenadorId);
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    console.log('Entrenador encontrado:', entrenador.nombre);

    // Verificar que el club existe
    const club = await db.collection('club').findOne({ 
      _id: new ObjectId(clubId) 
    });

    if (!club) {
      console.log('Club no encontrado:', clubId);
      return res.status(404).json({ error: 'Club no encontrado' });
    }

    console.log('Club encontrado:', club.nombre);

    // Verificar si ya existe una solicitud pendiente o aceptada
    const solicitudExistente = await db.collection('solicitudesEntrenadores').findOne({
      entrenadorId: new ObjectId(entrenadorId),
      clubId: new ObjectId(clubId),
      estado: { $in: ['pendiente', 'aceptada'] }
    });

    if (solicitudExistente) {
      console.log('Solicitud existente encontrada');
      return res.status(400).json({ error: 'Ya tienes una solicitud activa para este club' });
    }

    // Crear la solicitud
    const nuevaSolicitud = {
      entrenadorId: new ObjectId(entrenadorId),
      clubId: new ObjectId(clubId),
      mensaje: mensaje,
      estado: 'pendiente',
      fechaSolicitud: new Date(),
      nombreEntrenador: `${entrenador.nombre} ${entrenador.apellidopa} ${entrenador.apellidoma}`,
      emailEntrenador: entrenador.gmail,
      telefonoEntrenador: entrenador.telefono
    };

    console.log('Creando solicitud:', nuevaSolicitud);

    const result = await db.collection('solicitudesEntrenadores').insertOne(nuevaSolicitud);
    console.log('Solicitud creada con ID:', result.insertedId);

    res.json({ message: 'Solicitud enviada correctamente', solicitudId: result.insertedId });

  } catch (error) {
    console.error('Error al enviar solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// GET /api/entrenador/solicitudes/:id - Obtener solicitudes enviadas por el entrenador
router.get('/solicitudes/:id', async (req, res) => {
  try {
    const db = req.db;
    const entrenadorId = req.params.id;

    const solicitudes = await db.collection('solicitudesEntrenadores')
      .find({ entrenadorId: new ObjectId(entrenadorId) })
      .sort({ fechaSolicitud: -1 })
      .toArray();

    res.json(solicitudes);

  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/entrenador/perfil/:id - Obtener perfil del entrenador
router.get('/perfil/:id', async (req, res) => {
  try {
    const db = req.db;
    const entrenadorId = req.params.id;

    const entrenador = await db.collection('registro').findOne({ 
      _id: new ObjectId(entrenadorId), 
      rol: 'entrenador' 
    });

    if (!entrenador) {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    // Obtener información del club si está asignado
    let clubInfo = null;
    if (entrenador.clubId) {
      clubInfo = await db.collection('club').findOne({ 
        _id: new ObjectId(entrenador.clubId) 
      });
    }

    res.json({
      entrenador,
      club: clubInfo
    });

  } catch (error) {
    console.error('Error al obtener perfil del entrenador:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/entrenador/perfil/:id - Actualizar perfil del entrenador
router.put('/perfil/:id', async (req, res) => {
  try {
    const db = req.db;
    const entrenadorId = req.params.id;
    const { 
      nombre, apellidopa, apellidoma, telefono, gmail, 
      certificaciones, especialidades, añosExperiencia, estado 
    } = req.body;

    // Verificar que el entrenador existe
    const entrenador = await db.collection('registro').findOne({ 
      _id: new ObjectId(entrenadorId), 
      rol: 'entrenador' 
    });

    if (!entrenador) {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    // Construir objeto de actualización
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (apellidopa !== undefined) update.apellidopa = apellidopa;
    if (apellidoma !== undefined) update.apellidoma = apellidoma;
    if (telefono !== undefined) update.telefono = telefono;
    if (gmail !== undefined) update.gmail = gmail;
    if (certificaciones !== undefined) update.certificaciones = certificaciones;
    if (especialidades !== undefined) update.especialidades = especialidades;
    if (añosExperiencia !== undefined) update.añosExperiencia = añosExperiencia;
    if (estado !== undefined) update.estado = estado;

    // Actualizar entrenador
    const result = await db.collection('registro').updateOne(
      { _id: new ObjectId(entrenadorId) },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    res.json({ 
      success: true,
      message: 'Perfil actualizado correctamente',
      updatedData: update
    });

  } catch (error) {
    console.error('Error al actualizar perfil del entrenador:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
