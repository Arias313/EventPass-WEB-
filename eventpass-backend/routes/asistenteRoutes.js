// ============================================================
// routes/asistenteRoutes.js — se monta anidado bajo /api/eventos/:eventoId/asistentes
// mergeParams permite leer :eventoId aunque se defina en el router padre
// ============================================================

const express = require('express');
const router = express.Router({ mergeParams: true });

const { registrarAsistente, listarAsistentes } = require('../controllers/asistenteController');
const { protegerRuta } = require('../middleware/auth');

// Público: un asistente se auto-registra desde registro.html
router.post('/', registrarAsistente);

// Protegido: solo el admin dueño del evento ve el listado completo (dashboard)
router.get('/', protegerRuta, listarAsistentes);

module.exports = router;
