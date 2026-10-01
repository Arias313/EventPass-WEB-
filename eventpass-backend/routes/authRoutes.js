// ============================================================
// routes/authRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();

const { registrar, login, perfil } = require('../controllers/authController');
const { protegerRuta } = require('../middleware/auth');

router.post('/registro', registrar);
router.post('/login', login);
router.get('/perfil', protegerRuta, perfil);

module.exports = router;
