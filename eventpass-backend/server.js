// ============================================================
// server.js — Punto de entrada de la API de EventPass
// ============================================================

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

const app = express();
const esProduccion = process.env.NODE_ENV === 'production';
const corsOrigin = process.env.CORS_ORIGIN;
const origenesPermitidos = (corsOrigin || '*')
  .split(',')
  .map((s) => s.trim());

if (esProduccion && (!corsOrigin || !corsOrigin.trim() || origenesPermitidos.includes('*'))) {
  console.error('[CORS] En producción, CORS_ORIGIN debe contener una lista explícita de orígenes y no puede incluir "*".');
  process.exit(1);
}

// ─── Seguridad base ──────────────────────────────────────────
// Detrás de Render/Railway/Nginx hay 1 proxy: así req.ip es la IP real del cliente.
// En local no hay proxy; el valor 1 no causa problemas.
app.set('trust proxy', 1);

// La API la consume un frontend en otro origen: permitimos leer sus respuestas.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ─── CORS (se conserva tu lista de orígenes) ─────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origenesPermitidos.includes('*')) {
      return callback(null, true);
    }
    if (
      origenesPermitidos.includes(origin) ||
      (!esProduccion && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    ) {
      return callback(null, true);
    }
    return callback(new Error('Bloqueado por política CORS: ' + origin));
  },
  credentials: true
}));

// 100 kb: holgado para un lote de 200 check-ins offline, y aun así acotado.
app.use(express.json({ limit: '100kb' }));
app.use(morgan(esProduccion ? 'combined' : 'dev'));

// ─── Rutas ────────────────────────────────────────────────────
// Health antes del limitador global para que los monitores no consuman cuota.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, servicio: 'eventpass-backend', hora: new Date().toISOString() });
});

app.use('/api', limitadorGlobal);

app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/asistentes', asistentePublicRoutes);
app.use('/api/checkin', syncRoutes);

// ─── Manejo de errores ────────────────────────────────────────
app.use(noEncontrado);
app.use(manejadorErrores);

// ─── Arranque ─────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

async function iniciar() {
  try {
    await conectarDB();
    app.listen(PORT, () => {
      console.log(`[Server] EventPass API escuchando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Server] No se pudo iniciar:', error.message);
    process.exit(1);
  }
}

iniciar();

module.exports = app;