// ============================================================
// server.js — Punto de entrada de la API de EventPass
// ============================================================

const path = require('path');
const fs = require('fs');

// Cargar variables de entorno tanto desde backend/.env como desde la raíz si existe
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const conectarDB = require('./config/db');
const { noEncontrado, manejadorErrores } = require('./middleware/errores');
const { limitadorGlobal } = require('./middleware/limiters');

const authRoutes = require('./routes/authRoutes');
const eventoRoutes = require('./routes/eventoRoutes');
const asistentePublicRoutes = require('./routes/asistentePublicRoutes');
const syncRoutes = require('./routes/syncRoutes');

// ─── Validación de Entorno al Arrancar ─────────────────────────
function validarEntorno() {
  const errores = [];
  const advertencias = [];

  if (!process.env.MONGODB_URI) {
    errores.push('Falta MONGODB_URI en las variables de entorno.');
  }

  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      errores.push('Falta JWT_SECRET en las variables de entorno (requerido en producción).');
    } else {
      advertencias.push('JWT_SECRET no definido. Se usará una clave de desarrollo por defecto.');
      process.env.JWT_SECRET = 'dev_secret_eventpass_2026_fallback';
    }
  }

  advertencias.forEach((msg) => console.warn(`[Config] ⚠ ${msg}`));

  if (errores.length > 0) {
    errores.forEach((msg) => console.error(`[Config] ✖ ${msg}`));
    process.exit(1);
  }
}

validarEntorno();

const app = express();
const esProduccion = process.env.NODE_ENV === 'production';

// ─── Configuración de CORS ────────────────────────────────────
const corsOriginEnv = process.env.CORS_ORIGIN || '';
const origenesPermitidos = corsOriginEnv
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (esProduccion) {
  if (origenesPermitidos.length === 0 || origenesPermitidos.includes('*')) {
    console.warn('[CORS] ⚠ Advertencia: CORS_ORIGIN no está definido o incluye "*". ' +
      'Para mayor seguridad en la nube, configura la URL pública de tu frontend (ej. CORS_ORIGIN=https://tu-frontend.vercel.app).');
  } else {
    console.log('[CORS] Orígenes autorizados:', origenesPermitidos.join(', '));
  }
}

// ─── Seguridad base ──────────────────────────────────────────
// Detrás de Render/Railway/Nginx hay 1 proxy: así req.ip es la IP real del cliente.
app.set('trust proxy', 1);

// Permitir recursos cross-origin y habilitar scripts/canvas para la PWA
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: (origin, callback) => {
    // Permitir llamadas sin cabecera Origin (mismo origen, apps móviles, cURL, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Permitir comodín si está configurado explícitamente o si no hay lista restrictiva
    if (origenesPermitidos.includes('*') || origenesPermitidos.length === 0) {
      return callback(null, true);
    }

    // En desarrollo local permitir localhost y 127.0.0.1 en cualquier puerto
    if (!esProduccion && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    // Coincidencia exacta con lista de orígenes autorizados
    if (origenesPermitidos.includes(origin)) {
      return callback(null, true);
    }

    // Rechazo silencioso de CORS para evitar errores 500 no capturados
    return callback(null, false);
  },
  credentials: true
}));

// 100 kb: holgado para un lote de 200 check-ins offline, y aun así acotado.
app.use(express.json({ limit: '100kb' }));
app.use(morgan(esProduccion ? 'combined' : 'dev'));

// ─── Detección y Servicio de Frontend Estático (Modo Monolito) ─
const frontendPath = path.resolve(__dirname, '../eventpass-frontend-v2');
const servirFrontend = process.env.SERVE_FRONTEND === 'true' ||
  (process.env.SERVE_FRONTEND !== 'false' && fs.existsSync(frontendPath));

if (servirFrontend) {
  console.log(`[Frontend] Modo Fullstack activo: sirviendo estáticos desde ${frontendPath}`);
  app.use(express.static(frontendPath));
}

// ─── Rutas del Backend ────────────────────────────────────────

// Health check antes del limitador global para monitores de hosting
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    servicio: 'eventpass-backend',
    entorno: process.env.NODE_ENV || 'development',
    hora: new Date().toISOString()
  });
});

// Ruta raíz: si sirve frontend entrega el HTML principal, sino responde estado JSON
app.get('/', (req, res) => {
  if (servirFrontend) {
    return res.sendFile(path.join(frontendPath, 'index.html'));
  }
  res.json({
    ok: true,
    servicio: 'EventPass Backend API REST',
    estado: 'online',
    entorno: process.env.NODE_ENV || 'development',
    health: '/api/health',
    version: '1.0.0'
  });
});

// Rutas de API protegidas con rate limit
app.use('/api', limitadorGlobal);
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/asistentes', asistentePublicRoutes);
app.use('/api/checkin', syncRoutes);

// ─── Manejo de errores ────────────────────────────────────────
app.use(noEncontrado);
app.use(manejadorErrores);

// ─── Arranque del Servidor ────────────────────────────────────
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT) || 4000;

async function iniciar() {
  try {
    await conectarDB();
    app.listen(PORT, HOST, () => {
      console.log(`[Server] EventPass API escuchando en http://${HOST}:${PORT}`);
      console.log(`[Server] Modo: ${esProduccion ? 'PRODUCCIÓN' : 'DESARROLLO'}`);
    });
  } catch (error) {
    console.error('[Server] No se pudo iniciar:', error.message);
    process.exit(1);
  }
}

iniciar();

module.exports = app;