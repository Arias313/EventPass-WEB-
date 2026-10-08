// ============================================================
// routes/authRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();

const { registrar, login, perfil } = require('../controllers/authController');
const { limitadorLogin, limitadorRegistroAdmin } = require('../middleware/limiters');
const { protegerRuta } = require('../middleware/auth');

router.post('/registro', limitadorRegistroAdmin, registrar);
router.post('/login', limitadorLogin, login);
router.get('/perfil', protegerRuta, perfil);

module.exports = router;
