import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { rateLimiter } from './middlewares/rateLimiter.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { router } from './routes/index.js'

const app = express()

//Seguridad
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}))

//Limite de tasa global
app.use(rateLimiter)

//Cuerpo
app.use(express.json())

//Rutas
app.use('/api', router)

//Errores
app.use(errorHandler)

export default app