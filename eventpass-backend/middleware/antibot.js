// ============================================================
// middleware/antibot.js — Protección Honeypot y Cloudflare Turnstile
// ============================================================

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

async function validarAntiBot(req, res, next) {
  // 1. Verificación Honeypot: si el campo señuelo viene con datos, es un bot.
  const honeypot = req.body._hp_website || req.body.website || req.body.hp;
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return res.status(403).json({ error: 'Solicitud bloqueada por protección antibot.' });
  }

  // 2. Extraer token de Cloudflare Turnstile
  const token = req.body['cf-turnstile-response'] || req.body.turnstileToken;
  if (!token) {
    return res.status(400).json({ error: 'Falta la verificación de seguridad (Turnstile).' });
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY || TEST_SECRET_KEY;

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        remoteip: req.ip
      })
    });

    const resultado = await response.json();
    if (!resultado.success) {
      console.warn('[AntiBot] Desafío Turnstile no superado:', resultado['error-codes']);
      return res.status(403).json({ error: 'Verificación de seguridad fallida. Inténtalo de nuevo.' });
    }

    next();
  } catch (error) {
    console.error('[AntiBot] Excepción contactando Cloudflare:', error.message);
    // En caso de interrupción en la red de Cloudflare, permitimos continuar (fail-open)
    next();
  }
}

module.exports = { validarAntiBot };
