// ============================================================
// middleware/auth.js — Verifica el JWT en el header Authorization
// ============================================================

const jwt = require('jsonwebtoken');

/**
 * Protege una ruta: exige un token válido "Bearer <token>".
 * Si es válido, añade `req.adminId` con el id del admin autenticado.
 */
function protegerRuta(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [tipo, token] = authHeader.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autorizado. Falta el token de acceso.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.adminId = payload.adminId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

function generarToken(adminId) {
  return jwt.sign({ adminId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

module.exports = { protegerRuta, generarToken };
