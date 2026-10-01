// ============================================================
// routes/syncRoutes.js — Sincronización en lote de check-ins offline
// ============================================================

const express = require('express');
const router = express.Router();

const { sincronizarCheckins } = require('../controllers/asistenteController');
const { protegerRuta } = require('../middleware/auth');

// POST /api/checkin/sync
router.post('/sync', protegerRuta, sincronizarCheckins);

module.exports = router;
