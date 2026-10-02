// ============================================================
// routes/asistentePublicRoutes.js — Registro y consulta pública de pases
// ============================================================

const express = require('express');
const router = express.Router();

const {
  registrarAsistente,
  obtenerAsistentePublico
} = require('../controllers/asistenteController');

router.post('/', registrarAsistente);
router.get('/:id', obtenerAsistentePublico);

module.exports = router;