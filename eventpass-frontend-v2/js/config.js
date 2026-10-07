// ============================================================
// config.js — Configuración compartida del frontend
// ============================================================

// En despliegues separados, define window.EVENTPASS_API_BASE antes de cargar este archivo.
const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const defaultApiBase = localHost
  ? "http://localhost:4000/api"
  : `${window.location.origin}/api`;

window.EP_CONFIG={
  STORAGE_KEY:"eventpass_db_v1",
  CHANNEL:"eventpass_live",
  API_BASE:window.EVENTPASS_API_BASE || defaultApiBase
};
