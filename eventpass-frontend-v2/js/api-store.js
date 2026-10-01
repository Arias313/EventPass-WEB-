// ============================================================
// api-store.js — Capa de datos v2 de EventPass
// ------------------------------------------------------------
// Reemplaza a data-store.js (que simulaba todo con localStorage).
// Ahora habla con la API real (Express + MongoDB). Si una petición
// de registro o check-in falla por falta de red, se encola en
// IndexedDB (misma base que ya usaba app.js) y se reintenta sola
// cuando vuelve la conexión.
//
// Uso típico en una página:
//   const admin = await EventPassAPI.auth.login(email, password);
//   const eventos = await EventPassAPI.eventos.listarMisEventos();
//   await EventPassAPI.asistentes.registrar(eventoId, { nombre, email });
//   await EventPassAPI.checkin.hacer(eventoId, qrCode);
// ============================================================

const EventPassAPI = (() => {
  const TOKEN_KEY = 'eventpass_token';
  const ADMIN_KEY = 'eventpass_admin';

  const DB_NAME = 'eventpass-db';
  const DB_VERSION = 1;
  const STORE_PENDIENTES = 'checkins_pendientes';
  let dbPromise = null;

  function baseUrl() {
    return (window.EVENTPASS_CONFIG && window.EVENTPASS_CONFIG.API_BASE_URL) || '/api';
  }

  // ─── Sesión (token JWT) ───────────────────────────────────

  const auth = {
    guardarSesion(token, admin) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    },
    obtenerToken() {
      return localStorage.getItem(TOKEN_KEY);
    },
    obtenerAdmin() {
      const crudo = localStorage.getItem(ADMIN_KEY);
      return crudo ? JSON.parse(crudo) : null;
    },
    estaAutenticado() {
      return Boolean(auth.obtenerToken());
    },
    cerrarSesion() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADMIN_KEY);
    },

    async registrar(nombre, email, password) {
      const data = await _fetchJSON('/auth/registro', {
        method: 'POST',
        body: { nombre, email, password }
      });
      auth.guardarSesion(data.token, data.admin);
      return data.admin;
    },

    async login(email, password) {
      const data = await _fetchJSON('/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      auth.guardarSesion(data.token, data.admin);
      return data.admin;
    },

    async perfil() {
      const data = await _fetchJSON('/auth/perfil', { auth: true });
      return data.admin;
    }
  };

  // ─── Petición HTTP genérica ───────────────────────────────

 // ─── Petición HTTP genérica (Con Fallback Seguro) ─────────────

  async function _fetchJSON(path, { method = 'GET', body, auth: requiereAuth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (requiereAuth) {
      const token = auth.obtenerToken();
      // Si no hay token, simulated offline en vez de romper la app
      if (!token) {
        const error = new Error('Sesión no encontrada (modo offline/demo).');
        error.esErrorDeRed = true;
        throw error;
      }
      headers.Authorization = `Bearer ${token}`;
    }

    let respuesta;
    try {
      respuesta = await fetch(`${baseUrl()}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (errorDeRed) {
      const error = new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
      error.esErrorDeRed = true;
      throw error;
    }

    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      // Si el servidor responde 401 (no autorizado) o 404, lo tratamos como offline/fallback
      if (respuesta.status === 401 || respuesta.status === 404) {
        const error = new Error(data.error || 'Servidor no autorizó la operación.');
        error.esErrorDeRed = true; // Forzamos el guardado local en IndexedDB
        error.status = respuesta.status;
        throw error;
      }

      const error = new Error(data.error || `Error ${respuesta.status}`);
      error.status = respuesta.status;
      throw error;
    }

    return data;
  }

  // ─── Eventos ───────────────────────────────────────────────

  const eventos = {
    async crear({ nombre, fecha, ubicacion, capacidad }) {
      const data = await _fetchJSON('/eventos', {
        method: 'POST',
        auth: true,
        body: { nombre, fecha, ubicacion, capacidad }
      });
      return data.evento;
    },

    async listarMisEventos() {
      const data = await _fetchJSON('/eventos', { auth: true });
      return data.eventos;
    },

    async obtener(eventoId) {
      const data = await _fetchJSON(`/eventos/${eventoId}`);
      return data.evento;
    },

    async actualizar(eventoId, cambios) {
      const data = await _fetchJSON(`/eventos/${eventoId}`, {
        method: 'PUT',
        auth: true,
        body: cambios
      });
      return data.evento;
    },

    async eliminar(eventoId) {
      return _fetchJSON(`/eventos/${eventoId}`, { method: 'DELETE', auth: true });
    },

    async stats(eventoId) {
      return _fetchJSON(`/eventos/${eventoId}/stats`, { auth: true });
    }
  };

  // ─── Asistentes (registro) ───────────────────────────────────

  const asistentes = {
    /**
     * Registra a un asistente. Si no hay red, encola el registro en
     * IndexedDB y lo marca como pendiente de sincronizar.
     * Devuelve { online: true, asistente } o { online: false, pendiente }.
     */
    async registrar(eventoId, { nombre, email, empresa }) {
      if (!navigator.onLine) {
        const pendiente = await _agregarPendiente({
          tipo: 'registro',
          eventoId,
          payload: { nombre, email, empresa }
        });
        return { online: false, pendiente };
      }

      try {
        const data = await _fetchJSON(`/eventos/${eventoId}/asistentes`, {
          method: 'POST',
          body: { nombre, email, empresa }
        });
        return { online: true, asistente: data.asistente };
      } catch (error) {
        if (error.esErrorDeRed) {
          const pendiente = await _agregarPendiente({
            tipo: 'registro',
            eventoId,
            payload: { nombre, email, empresa }
          });
          return { online: false, pendiente };
        }
        throw error; // errores de validación del servidor sí deben mostrarse al usuario
      }
    },

    async listar(eventoId) {
      const data = await _fetchJSON(`/eventos/${eventoId}/asistentes`, { auth: true });
      return data.asistentes;
    }
  };

  // ─── Check-in ────────────────────────────────────────────────

  const checkin = {
    /**
     * Hace check-in de un qrCode dentro de un evento.
     * Si no hay red, lo encola en IndexedDB para sincronizar después.
     * Devuelve { online: true, status, asistente } o { online: false, pendiente }.
     */
    async hacer(eventoId, qrCode) {
      if (!navigator.onLine) {
        const pendiente = await _agregarPendiente({ tipo: 'checkin', eventoId, payload: { qrCode } });
        return { online: false, pendiente };
      }

      try {
        const data = await _fetchJSON(`/eventos/${eventoId}/checkin`, {
          method: 'POST',
          auth: true,
          body: { qrCode }
        });
        return { online: true, ...data };
      } catch (error) {
        if (error.esErrorDeRed) {
          const pendiente = await _agregarPendiente({ tipo: 'checkin', eventoId, payload: { qrCode } });
          return { online: false, pendiente };
        }
        throw error;
      }
    }
  };

  // ─── IndexedDB — cola de operaciones pendientes offline ──────

  function _abrirDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const solicitud = indexedDB.open(DB_NAME, DB_VERSION);

      solicitud.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(STORE_PENDIENTES)) {
          const store = database.createObjectStore(STORE_PENDIENTES, { keyPath: 'id', autoIncrement: true });
          store.createIndex('tipo', 'tipo', { unique: false });
          store.createIndex('eventoId', 'eventoId', { unique: false });
        }
      };

      solicitud.onsuccess = (event) => resolve(event.target.result);
      solicitud.onerror = (event) => reject(event.target.error);
    });

    return dbPromise;
  }

  async function _agregarPendiente(operacion) {
    const db = await _abrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDIENTES, 'readwrite');
      const store = tx.objectStore(STORE_PENDIENTES);
      const registro = { ...operacion, timestampLocal: new Date().toISOString(), sincronizado: false };
      const solicitud = store.add(registro);
      solicitud.onsuccess = () => resolve({ ...registro, id: solicitud.result });
      solicitud.onerror = () => reject(solicitud.error);
    });
  }

  async function _listarPendientes() {
    const db = await _abrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDIENTES, 'readonly');
      const solicitud = tx.objectStore(STORE_PENDIENTES).getAll();
      solicitud.onsuccess = () => resolve(solicitud.result);
      solicitud.onerror = () => reject(solicitud.error);
    });
  }

  async function _eliminarPendiente(id) {
    const db = await _abrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDIENTES, 'readwrite');
      const solicitud = tx.objectStore(STORE_PENDIENTES).delete(id);
      solicitud.onsuccess = () => resolve();
      solicitud.onerror = () => reject(solicitud.error);
    });
  }

  // ─── Sincronización al reconectar ────────────────────────────

  const sync = {
    /** Cuántas operaciones siguen esperando ser sincronizadas. */
    async contarPendientes() {
      const pendientes = await _listarPendientes();
      return pendientes.length;
    },

    /**
     * Envía todas las operaciones pendientes a la API.
     * Los check-ins se agrupan y se mandan en lote a /api/checkin/sync;
     * los registros se mandan uno por uno a /api/eventos/:id/asistentes
     * (no requieren login, así que se sincronizan aunque el dispositivo
     * del scanner no tenga sesión de admin).
     */
    async sincronizarPendientes() {
      if (!navigator.onLine) return { sincronizados: 0, fallidos: 0 };

      const pendientes = await _listarPendientes();
      if (pendientes.length === 0) return { sincronizados: 0, fallidos: 0 };

      let sincronizados = 0;
      let fallidos = 0;

      const checkinsPendientes = pendientes.filter((p) => p.tipo === 'checkin');
      const registrosPendientes = pendientes.filter((p) => p.tipo === 'registro');

      // Check-ins en lote (requiere sesión de admin/staff en este dispositivo)
      if (checkinsPendientes.length > 0 && auth.estaAutenticado()) {
        try {
          const data = await _fetchJSON('/checkin/sync', {
            method: 'POST',
            auth: true,
            body: {
              checkins: checkinsPendientes.map((p) => ({
                idLocal: p.id,
                eventoId: p.eventoId,
                qrCode: p.payload.qrCode
              }))
            }
          });
          for (const resultado of data.resultados) {
            if (resultado.status === 'ok' || resultado.status === 'ya_registrado') {
              await _eliminarPendiente(resultado.idLocal);
              sincronizados++;
            } else {
              fallidos++;
            }
          }
        } catch (error) {
          console.warn('[API] No se pudieron sincronizar los check-ins pendientes:', error.message);
          fallidos += checkinsPendientes.length;
        }
      }

      // Registros uno por uno (ruta pública, no necesita sesión)
      for (const pendiente of registrosPendientes) {
        try {
          await _fetchJSON(`/eventos/${pendiente.eventoId}/asistentes`, {
            method: 'POST',
            body: pendiente.payload
          });
          await _eliminarPendiente(pendiente.id);
          sincronizados++;
        } catch (error) {
          console.warn('[API] No se pudo sincronizar un registro pendiente:', error.message);
          fallidos++;
        }
      }

      return { sincronizados, fallidos };
    }
  };

  // Reintenta automáticamente al recuperar la conexión
  window.addEventListener('online', () => {
    sync.sincronizarPendientes().then(({ sincronizados }) => {
      if (sincronizados > 0) {
        console.log(`[API] ${sincronizados} operación(es) pendiente(s) sincronizada(s).`);
      }
    });
  });

  return { auth, eventos, asistentes, checkin, sync };
})();
