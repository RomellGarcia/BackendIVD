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
    clubId, // Nuevo campo opcional
    certificaciones,
    especialidades,
    añosExperiencia,
    estado
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

  // Validar formato de teléfono (exactamente 10 dígitos)
  const telefonoLimpio = telefono.replace(/\D/g, '');
  if (telefonoLimpio.length !== 10) {
    return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos' });
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

    // Si es entrenador, agregar campos específicos
    if (rol === 'entrenador') {
      nuevoUsuario.certificaciones = certificaciones || [];
      nuevoUsuario.especialidades = especialidades || [];
      nuevoUsuario.añosExperiencia = añosExperiencia || 0;
      nuevoUsuario.estado = estado || 'activo';
      if (clubId) {
        nuevoUsuario.clubId = clubId;
      }
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

// PUT /api/registros/:id - Actualizar usuario (atleta, entrenador, etc.)
router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    const { 
      nombre, apellidopa, apellidoma, fechaNacimiento, telefono, gmail, sexo, 
      estadoNacimiento, clubId, rol, certificaciones, especialidades, añosExperiencia, estado 
    } = req.body;
    
    // Verificar que el usuario existe
    const usuario = await db.collection('registro').findOne({ _id: new ObjectId(req.params.id) });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Si solo se está actualizando el clubId (desasociación) para atletas
    if (usuario.rol === 'atleta' && Object.keys(req.body).length === 1 && req.body.hasOwnProperty('clubId')) {
      if (clubId === null) {
        // Desasociar del club - solo quitar clubId
        const result = await db.collection('registro').updateOne(
          { _id: new ObjectId(req.params.id), rol: 'atleta' },
          { $unset: { clubId: '' } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Atleta no encontrado' });
        return res.json({ message: 'Atleta desasociado correctamente del club' });
      } else {
        // Asociar a un club - solo actualizar clubId
        const result = await db.collection('registro').updateOne(
          { _id: new ObjectId(req.params.id), rol: 'atleta' },
          { $set: { clubId: clubId } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Atleta no encontrado' });
        return res.json({ message: 'Atleta asociado correctamente al club' });
      }
    }
    
    // Actualización de datos personales y profesionales
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (apellidopa !== undefined) update.apellidopa = apellidopa;
    if (apellidoma !== undefined) update.apellidoma = apellidoma;
    if (fechaNacimiento !== undefined) update.fechaNacimiento = fechaNacimiento;
    if (telefono !== undefined) update.telefono = telefono;
    if (gmail !== undefined) update.gmail = gmail;
    if (sexo !== undefined) update.sexo = sexo;
    if (estadoNacimiento !== undefined) update.estadoNacimiento = estadoNacimiento;
    if (rol !== undefined) update.rol = rol;
    
    // Campos específicos para entrenadores
    if (certificaciones !== undefined) update.certificaciones = certificaciones;
    if (especialidades !== undefined) update.especialidades = especialidades;
    if (añosExperiencia !== undefined) update.añosExperiencia = añosExperiencia;
    if (estado !== undefined) update.estado = estado;
    
    // Manejo de clubId
    if (clubId !== undefined) {
      if (clubId === null) {
        // Si clubId es null, quitar el campo clubId
        await db.collection('registro').updateOne(
          { _id: new ObjectId(req.params.id) },
          { $unset: { clubId: '' } }
        );
      } else {
        // Si clubId tiene un valor, actualizarlo
        update.clubId = clubId;
      }
    }
    
    // Solo actualizar si hay campos para actualizar
    if (Object.keys(update).length > 0) {
      const result = await db.collection('registro').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: update }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ message: 'Datos actualizados correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario', details: error.message });
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

// GET /api/registros/solicitudes-club?clubId=...&atletaId=... - Listar solicitudes para un club o atleta
router.get('/solicitudes-club', async (req, res) => {
  try {
    const db = req.db;
    const { clubId, atletaId } = req.query;
    let filtro = {};
    if (clubId) filtro.clubId = clubId;
    if (atletaId) filtro.atletaId = atletaId;
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
        { $set: { 
          clubId: solicitud.clubId,
          fechaIngresoClub: new Date() // Guardar fecha de ingreso al club
        } }
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

// GET /api/registros/atletas-club?clubId=... - Obtener atletas de un club específico
router.get('/atletas-club', async (req, res) => {
  try {
    const db = req.db;
    const { clubId, limit, sort } = req.query;
    
    if (!clubId) {
      return res.status(400).json({ error: 'clubId es requerido' });
    }

    let query = db.collection('registro').find({ 
      clubId: clubId, 
      rol: 'atleta' 
    });

    // Aplicar ordenamiento si se especifica
    if (sort === 'createdAt') {
      query = query.sort({ _id: -1 }); // Más recientes primero (por _id que incluye timestamp)
    }

    // Aplicar límite si se especifica
    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum)) {
        query = query.limit(limitNum);
      }
    }

    const atletas = await query.toArray();

    // Calcular edad para cada atleta
    const atletasConEdad = atletas.map(atleta => {
      const fechaActual = new Date();
      const fechaNac = new Date(atleta.fechaNacimiento);
      const edad = fechaActual.getFullYear() - fechaNac.getFullYear();
      const mes = fechaActual.getMonth() - fechaNac.getMonth();
      const edadReal = mes < 0 || (mes === 0 && fechaActual.getDate() < fechaNac.getDate()) ? edad - 1 : edad;
      
      return {
        ...atleta,
        edad: edadReal
      };
    });

    res.json(atletasConEdad);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener atletas del club', details: error.message });
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

// GET /api/registros?rol=atleta&sinClub=true - Obtener atletas sin club
router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const { rol, sinClub } = req.query;
    
    let filtro = {};
    if (rol) {
      filtro.rol = rol;
    }
    
    // Si se solicita atletas sin club
    if (sinClub === 'true' && rol === 'atleta') {
      filtro.$or = [
        { clubId: { $exists: false } },
        { clubId: null }
      ];
    }
    
    const usuarios = await db.collection('registro').find(filtro).toArray();
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios', details: error.message });
  }
});

// PUT /api/registros/:id - Actualizar registro de usuario (para expulsar atleta del club)
router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const updateData = req.body;

    // Verificar que el usuario existe
    const usuario = await db.collection('registro').findOne({ _id: new ObjectId(id) });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Actualizar el usuario
    const result = await db.collection('registro').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Obtener el usuario actualizado
    const usuarioActualizado = await db.collection('registro').findOne({ _id: new ObjectId(id) });
    res.json(usuarioActualizado);
  } catch (error) {
    console.error('❌ Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario', details: error.message });
  }
});

// DELETE /api/registros/:id - Eliminar un usuario (atleta, club, etc.)
router.delete('/:id', async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;

    // Verificar que el usuario existe
    const usuario = await db.collection('registro').findOne({ _id: new ObjectId(id) });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Si es un atleta, verificar si tiene participaciones en eventos
    if (usuario.rol === 'atleta') {
      // Verificar si el atleta tiene resultados registrados
      const resultados = await db.collection('resultados').find({ 
        atletaId: id 
      }).toArray();

      if (resultados.length > 0) {
        return res.status(400).json({ 
          error: 'No se puede eliminar el atleta porque tiene resultados registrados. Primero elimine todos los resultados asociados.' 
        });
      }

      // Verificar si el atleta tiene participaciones en eventos
      const participaciones = await db.collection('eventos').find({
        'participantes.atletaId': id
      }).toArray();

      if (participaciones.length > 0) {
        return res.status(400).json({ 
          error: 'No se puede eliminar el atleta porque está participando en eventos. Primero elimine sus participaciones.' 
        });
      }
    }

    // Si es un club, verificar si tiene atletas asociados
    if (usuario.rol === 'club') {
      const atletasAsociados = await db.collection('registro').find({ 
        clubId: id, 
        rol: 'atleta' 
      }).toArray();

      if (atletasAsociados.length > 0) {
        return res.status(400).json({ 
          error: 'No se puede eliminar el club porque tiene atletas asociados. Primero desasocia todos los atletas.' 
        });
      }
    }

    // Eliminar el usuario
    const result = await db.collection('registro').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error al eliminar usuario', details: error.message });
  }
});

module.exports = router;
