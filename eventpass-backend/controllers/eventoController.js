// ============================================================
// controllers/eventoController.js — CRUD de eventos
// ============================================================

const Evento = require('../models/Evento');
const Asistente = require('../models/Asistente');

/** POST /api/eventos — crea un evento (requiere auth) */
async function crearEvento(req, res, next) {
  try {
    const { nombre, fecha, ubicacion, capacidad } = req.body;

    if (!nombre || !fecha) {
      return res.status(400).json({ error: 'Nombre y fecha del evento son obligatorios.' });
    }

    const evento = await Evento.create({
      adminId: req.adminId,
      nombre,
      fecha,
      ubicacion,
      capacidad
    });

    res.status(201).json({ evento });
  } catch (error) {
    next(error);
  }
}

/** GET /api/eventos — lista los eventos del admin autenticado */
async function listarMisEventos(req, res, next) {
  try {
    const eventos = await Evento.find({ adminId: req.adminId }).sort({ fecha: 1 });

    // Adjunta un conteo rápido de asistentes/check-ins a cada evento (para la vista "Mis eventos")
    const eventosConConteo = await Promise.all(
      eventos.map(async (evento) => {
        const [registrados, confirmados] = await Promise.all([
          Asistente.countDocuments({ eventoId: evento._id }),
          Asistente.countDocuments({ eventoId: evento._id, estadoCheckin: true })
        ]);
        return { ...evento.toJSON(), registrados, confirmados };
      })
    );

    res.json({ eventos: eventosConConteo });
  } catch (error) {
    next(error);
  }
}

/** GET /api/eventos/:eventoId — info pública básica del evento (para registro/scanner/dashboard) */
async function obtenerEvento(req, res, next) {
  try {
    const evento = await Evento.findById(req.params.eventoId);
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado.' });
    res.json({ evento });
  } catch (error) {
    next(error);
  }
}

/** PUT /api/eventos/:eventoId — edita un evento (solo su dueño) */
async function actualizarEvento(req, res, next) {
  try {
    const evento = await _verificarPropiedad(req, res);
    if (!evento) return;

    const { nombre, fecha, ubicacion, capacidad } = req.body;
    if (nombre !== undefined) evento.nombre = nombre;
    if (fecha !== undefined) evento.fecha = fecha;
    if (ubicacion !== undefined) evento.ubicacion = ubicacion;
    if (capacidad !== undefined) evento.capacidad = capacidad;

    await evento.save();
    res.json({ evento });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/eventos/:eventoId — elimina un evento y sus asistentes (solo su dueño) */
async function eliminarEvento(req, res, next) {
  try {
    const evento = await _verificarPropiedad(req, res);
    if (!evento) return;

    await Promise.all([
      Asistente.deleteMany({ eventoId: evento._id }),
      evento.deleteOne()
    ]);

    res.json({ mensaje: 'Evento eliminado correctamente.' });
  } catch (error) {
    next(error);
  }
}

/** Helper interno: valida que el evento exista y pertenezca al admin autenticado */
async function _verificarPropiedad(req, res) {
  const evento = await Evento.findById(req.params.eventoId);
  if (!evento) {
    res.status(404).json({ error: 'Evento no encontrado.' });
    return null;
  }
  if (String(evento.adminId) !== String(req.adminId)) {
    res.status(403).json({ error: 'No tienes permiso sobre este evento.' });
    return null;
  }
  return evento;
}

module.exports = { crearEvento, listarMisEventos, obtenerEvento, actualizarEvento, eliminarEvento };
