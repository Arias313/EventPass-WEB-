// ============================================================
// routes/eventoRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();

const {
  crearEvento,
  listarMisEventos,
  obtenerEvento,
  actualizarEvento,
  eliminarEvento
} = require('../controllers/eventoController');

const { checkin, estadisticasEvento } = require('../controllers/asistenteController');
const { protegerRuta } = require('../middleware/auth');
const asistenteRoutes = require('./asistenteRoutes');

// ─── CRUD de eventos (requiere sesión de admin, salvo la lectura individual) ──
router.post('/', protegerRuta, crearEvento);
router.get('/', protegerRuta, listarMisEventos);
router.get('/:eventoId', obtenerEvento); // pública: la usan registro/scanner/dashboard para mostrar el nombre del evento
router.put('/:eventoId', protegerRuta, actualizarEvento);
router.delete('/:eventoId', protegerRuta, eliminarEvento);

// ─── Estadísticas y check-in del evento (requieren sesión) ────────────────────
router.get('/:eventoId/stats', protegerRuta, estadisticasEvento);
router.post('/:eventoId/checkin', protegerRuta, checkin);

// ─── Sub-rutas de asistentes: /api/eventos/:eventoId/asistentes ──────────────
router.use('/:eventoId/asistentes', asistenteRoutes);

module.exports = router;
