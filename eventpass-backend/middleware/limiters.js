// ============================================================
// middleware/limiters.js — Límites de peticiones por IP
// ============================================================

const rateLimit = require('express-rate-limit');

const base = {
  standardHeaders: true,
  legacyHeaders: false
};

const mensaje = (texto) => ({ error: texto });

// Red de seguridad para toda la API. En un evento físico todo el recinto (escáneres,
// dashboards y asistentes) suele salir por UNA sola IP pública (WiFi/NAT), así que el
// límite debe cubrir a todo el lugar, no a una persona (~11 peticiones/s sostenidas).
const limitadorGlobal = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10000,
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

// Registro público de asistentes: holgado, porque en un evento real cientos de
// personas se registran en sitio compartiendo la misma red WiFi (misma IP).
// Turnstile + honeypot son la defensa principal contra bots, no este límite.
const limitadorRegistroAsistente = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 500,
  message: mensaje('Demasiados registros desde esta red. Inténtalo de nuevo en unos minutos.')
});

// Consulta pública de pases: en la puerta muchos asistentes abren su pase desde la
// misma red. El PIN tiene 64 bits aleatorios, así que este límite no debilita la
// protección contra fuerza bruta.
const limitadorConsultaPase = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  message: mensaje('Demasiadas consultas. Inténtalo de nuevo en unos minutos.')
});

module.exports = {
  limitadorGlobal,
  limitadorLogin,
  limitadorRegistroAdmin,
  limitadorRegistroAsistente,
  limitadorConsultaPase
};
