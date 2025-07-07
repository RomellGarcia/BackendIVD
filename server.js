const express = require('express');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const cloudinary = require('cloudinary').v2;

dotenv.config();

const app = express();
app.use(express.json());

// Configurar CORS
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));

// Configurar fileUpload para manejar archivos
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
}));

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Crear instancia del cliente
const client = new MongoClient(process.env.MONGODB_URI);

let db; // Variable global para la base de datos

// Función para iniciar el servidor
async function startServer() {
  try {
    // Conectar a MongoDB
    await client.connect();
    db = client.db(); // Usa la base definida en el URI (IDVbd)
    console.log('✅ Conectado a MongoDB - IDVbd');

    // Crear índices únicos para curp (si no existen)
    await db.collection('usuarios').createIndex({ curp: 1 }, { unique: true });

    // Middleware para inyectar `req.db`
    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    // Importar rutas existentes
    const terminosR = require('./rutas/terminos');
    const registro = require('./rutas/registros');
    const login = require('./rutas/login');

    // Usar rutas existentes
    app.use('/api/terminos', terminosR);
    app.use('/api/registros', registro);
    app.use('/api/login', login);

    // Nuevo endpoint para subir el logo y actualizar el perfil
    app.post('/api/perfil/upload', async (req, res) => {
      try {
        if (!req.files || !req.files.logo) {
          return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const file = req.files.logo;
        const result = await cloudinary.uploader.upload(file.tempFilePath, {
          folder: 'instituto-veracruzano-deporte', // Carpeta opcional en Cloudinary
        });

        const perfil = await req.db.collection('perfiles').findOneAndUpdate(
          {},
          { $set: { NombreEmpresa: 'Instituto Veracruzano del Deporte', Logo: result.secure_url } },
          { upsert: true, returnDocument: 'after' } // Devuelve el documento actualizado
        );

        res.json(perfil.value);
      } catch (error) {
        console.error('Error al subir el logo:', error);
        res.status(500).json({ error: 'Error al procesar la subida' });
      }
    });

    // Nuevo endpoint para obtener el perfil
    app.get('/api/perfil', async (req, res) => {
      try {
        const perfil = await req.db.collection('perfiles').findOne() || { NombreEmpresa: 'Instituto Veracruzano del Deporte', Logo: '' };
        res.json(perfil);
      } catch (error) {
        console.error('Error al obtener el perfil:', error);
        res.status(500).json({ error: 'Error al obtener el perfil' });
      }
    });

    // Ruta de prueba
    app.get('/', (req, res) => {
      res.send('Servidor conectado a MongoDB y funcionando 🚀');
    });

    // Iniciar servidor
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ No se pudo conectar a MongoDB:', error.message);
    process.exit(1);
  }
}

// Iniciar todo
startServer();

// Manejar cierre del servidor
process.on('SIGTERM', async () => {
  await client.close();
  console.log('✅ Conexión a MongoDB cerrada');
  process.exit(0);
});

process.on('SIGINT', async () => {
  await client.close();
  console.log('✅ Conexión a MongoDB cerrada');
  process.exit(0);
});