// ============================================================
// middleware/limiters.js — Límites de peticiones por IP
// ============================================================

const rateLimit = require('express-rate-limit');

const base = {
  standardHeaders: true,
  legacyHeaders: false
};

const mensaje = (texto) => ({ error: texto });

// Red de seguridad para toda la API. Holgado: el dashboard consulta cada 8 s.
const limitadorGlobal = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  message: mensaje('Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.')
});

// Login: estricto contra fuerza bruta. Los inicios correctos no cuentan.
const limitadorLogin = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_LIMIT) || 10,
  skipSuccessfulRequests: true,
  message: mensaje('Demasiados intentos de inicio de sesión. Espera 15 minutos.')
});

// Alta de administradores: pocas por hora y por IP.
const limitadorRegistroAdmin = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: mensaje('Demasiados registros desde esta red. Inténtalo más tarde.')
});

// Registro público de asistentes: más holgado, porque en un evento real
// muchas personas comparten la misma red wifi.
const limitadorRegistroAsistente = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 40,
  message: mensaje('Demasiados registros desde esta red. Inténtalo de nuevo en unos minutos.')
});

// Consulta pública de pases: evita probar PIN por fuerza bruta.
const limitadorConsultaPase = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: mensaje('Demasiadas consultas. Inténtalo de nuevo en unos minutos.')
});

module.exports = {
  limitadorGlobal,
  limitadorLogin,
  limitadorRegistroAdmin,
  limitadorRegistroAsistente,
  limitadorConsultaPase
};
