// ============================================================
// config.js — Configuración compartida del frontend
// ============================================================

// Cambia esto a la URL de tu backend en producción (ej. https://api.tuevento.com/api)
window.EP_CONFIG={
  STORAGE_KEY:"eventpass_db_v1",
  CHANNEL:"eventpass_live",
  API_BASE:null, // Si defines una URL, sustituye EPStore por llamadas fetch a tu backend.
  ADMIN:{email:"admin@eventpass.com",password:"admin123"} // Solo demo
};
