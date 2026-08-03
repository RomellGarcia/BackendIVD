import express      from 'express'
import helmet       from 'helmet'
import cors         from 'cors'
import fileUpload   from 'express-fileupload'
import cloudinary   from 'cloudinary'
import { router }   from './routes/index.js'
import { rateLimiter }  from './middlewares/rateLimiter.js'
import { errorHandler } from './middlewares/errorHandler.js'

//Config Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const app = express()

//Cors
app.use(helmet())
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'https://front-ivd.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}))


app.use(rateLimiter)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(fileUpload({ useTempFiles: true, tempFileDir: '/tmp/' }))

//Rutas
app.use('/api', router)

//Health checks
app.get('/api/test', (req, res) => {
  res.json({ message: 'Servidor IVD funcionando', timestamp: new Date() })
})
app.get('/', (req, res) => {
  res.send('Servidor IVD conectado a PostgreSQL')
})

app.use(errorHandler)

export default app