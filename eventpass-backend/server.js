// ============================================================
// server.js — Punto de entrada de la API de EventPass
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const conectarDB = require('./config/db');
const { noEncontrado, manejadorErrores } = require('./middleware/errores');

const authRoutes = require('./routes/authRoutes');
const eventoRoutes = require('./routes/eventoRoutes');
const asistentePublicRoutes = require('./routes/asistentePublicRoutes');
const syncRoutes = require('./routes/syncRoutes');

const app = express();

// ─── Middleware base ─────────────────────────────────────────
const origenesPermitidos = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim());

app.use(cors({
  origin: origenesPermitidos.includes('*') ? true : origenesPermitidos,
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// ─── Rutas ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, servicio: 'eventpass-backend', hora: new Date().toISOString() });
});

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
