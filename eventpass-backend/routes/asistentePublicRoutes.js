// ============================================================
// routes/asistentePublicRoutes.js — Registro y consulta pública de pases
// ============================================================

const express = require('express');
const router = express.Router();

const {
  registrarAsistente,
  obtenerAsistentePublico
} = require('../controllers/asistenteController');
const {
  limitadorRegistroAsistente,
  limitadorConsultaPase
} = require('../middleware/limiters');
const { validarAntiBot } = require('../middleware/antibot');

router.post('/', limitadorRegistroAsistente, validarAntiBot, registrarAsistente);
router.get('/:id', limitadorConsultaPase, obtenerAsistentePublico);

module.exports = router;