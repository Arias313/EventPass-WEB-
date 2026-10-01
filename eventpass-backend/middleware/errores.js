// ============================================================
// middleware/errores.js — Manejo centralizado de errores
// ============================================================

/** 404 para rutas no encontradas */
function noEncontrado(req, res, next) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

/** Middleware final de errores — traduce errores comunes de Mongoose a respuestas claras */
function manejadorErrores(err, req, res, next) {
  console.error('[Error]', err);

  // Errores de validación de Mongoose
  if (err.name === 'ValidationError') {
    const mensajes = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: mensajes.join(' ') });
  }

  // Índice único duplicado (ej. email repetido, qrCode repetido en el mismo evento)
  if (err.code === 11000) {
    const campo = Object.keys(err.keyValue || {}).join(', ');
    return res.status(409).json({ error: `Ya existe un registro con ese ${campo}.` });
  }

  // Id de Mongo con formato inválido
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Identificador inválido: ${err.value}` });
  }

  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
}

module.exports = { noEncontrado, manejadorErrores };
