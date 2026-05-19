const express = require('express');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function startServer() {
  try {
    await client.connect();
    db = client.db();
    console.log('✅ Conectado a MongoDB');
    
    app.use((req, res, next) => {
      req.db = db;
      next();
    });
    
    // Ruta de login simplificada para prueba
    app.post('/api/login', async (req, res) => {
      const { rol, curp, password } = req.body;
      console.log('Login intent:', { rol, curp, password });
      
      try {
        const user = await db.collection('registro').findOne({ curp, rol });
        if (!user) {
          return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ message: 'Login exitoso', user: { nombre: user.nombre } });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/api/test', (req, res) => {
      res.json({ message: 'Server test funcionando' });
    });
    
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server test en http://localhost:${PORT}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

startServer();