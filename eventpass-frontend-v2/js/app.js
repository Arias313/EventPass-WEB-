// ============================================================
// app.js — Núcleo PWA, Estado de Red, Instalación y Sincronización
// ============================================================

window.EventPassUI = {
  mostrarToast(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.className = `app-toast toast-${tipo}`;
    toast.setAttribute('role', 'status');
    toast.textContent = mensaje;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 300);
    }, 4200);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Iniciando EventPass...');

  // ─── 1. REGISTRO DEL SERVICE WORKER ────────────────────────
  async function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[App] Este navegador no soporta Service Workers.');
      mostrarBanner('Tu navegador no soporta funciones de PWA offline.', 'warning');
      return;
    }

    try {
      let registro;
      try {
        registro = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      } catch {
        registro = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
      console.log('[App] Service Worker registrado con éxito. Scope:', registro.scope);

      registro.addEventListener('updatefound', () => {
        const nuevoSW = registro.installing;
        if (!nuevoSW) return;

        nuevoSW.addEventListener('statechange', () => {
          if (nuevoSW.state === 'installed' && navigator.serviceWorker.controller) {
            mostrarBannerActualizacion();
          }
        });
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_EVENTPASS') {
          ejecutarSincronizacion();
        }
      });

    } catch (error) {
      console.error('[App] Error al registrar el Service Worker:', error);
    }
  }

  // ─── 2. DETECCIÓN DE CONEXIÓN Y ESTADO DE RED ─────────────
  function configurarDeteccionConexion() {
    const actualizarEstado = async () => {
      const estaOnline = navigator.onLine;
      document.body.classList.toggle('offline', !estaOnline);

      const indicador = document.getElementById('connection-status');
      if (indicador) {
        indicador.textContent = estaOnline ? '● En línea' : '○ Sin conexión';
        indicador.className = estaOnline ? 'status-online' : 'status-offline';
      }

      if (!estaOnline) {
        mostrarBanner('Sin conexión. Las operaciones se guardarán localmente y se sincronizarán al reconectar.', 'offline');
      } else {
        ocultarBanner();
        // Solo intentar sincronización si el usuario ha iniciado sesión explícitamente
        if (typeof EventPassAPI !== 'undefined' && EventPassAPI.auth && EventPassAPI.auth.estaAutenticado()) {
          ejecutarSincronizacion();
        }
      }
    };

    window.addEventListener('online', actualizarEstado);
    window.addEventListener('offline', actualizarEstado);
    actualizarEstado(); // Estado inicial
  }

  // ─── 3. SINCRONIZACIÓN SEGURO CON LA API ───────────────────
  async function ejecutarSincronizacion() {
    if (!navigator.onLine) return;

    if (typeof EventPassAPI !== 'undefined' && EventPassAPI.sync) {
      // Validación previa de autenticación antes de solicitar sincronización a la API
      if (EventPassAPI.auth && !EventPassAPI.auth.estaAutenticado()) {
        console.warn('[App] Sincronización omitida: Usuario no autenticado.');
        return;
      }

      try {
        const totalPendientes = await EventPassAPI.sync.contarPendientes();
        if (totalPendientes > 0) {
          console.log(`[App] Procesando ${totalPendientes} operaciones pendientes...`);
          const resultado = await EventPassAPI.sync.sincronizarPendientes();

          if (resultado && resultado.sincronizados > 0) {
            mostrarToast(`✅ Se sincronizaron ${resultado.sincronizados} operaciones pendientes.`);
          }
        }
      } catch (error) {
        console.error('[App] Error durante la sincronización:', error);
      }
    }
  }

  // ─── 4. PROMPT DE INSTALACIÓN PWA ─────────────────────────
  let promptInstalacion = null;

  function configurarInstalacion() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      promptInstalacion = event;

      const btnInstalar = document.getElementById('btn-instalar');
      if (btnInstalar) {
        btnInstalar.style.display = 'inline-flex';
        btnInstalar.onclick = async () => {
          if (!promptInstalacion) return;
          promptInstalacion.prompt();
          const { outcome } = await promptInstalacion.userChoice;
          console.log(`[App] Instalación ${outcome === 'accepted' ? 'aceptada' : 'rechazada'}.`);
          promptInstalacion = null;
          btnInstalar.style.display = 'none';
        };
      }
    });

    window.addEventListener('appinstalled', () => {
      console.log('[App] EventPass ha sido instalada.');
      promptInstalacion = null;
      const btnInstalar = document.getElementById('btn-instalar');
      if (btnInstalar) btnInstalar.style.display = 'none';
      mostrarToast('¡App instalada correctamente!');
    });
  }

  // ─── 5. UI HELPERS Y NOTIFICACIONES ────────────────────────
  function mostrarBanner(mensaje, tipo = 'info') {
    let banner = document.getElementById('app-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'app-banner';
      document.body.prepend(banner);
    }
    banner.textContent = mensaje;
    banner.className = `app-banner banner-${tipo}`;
    banner.style.display = 'flex';
  }

  function ocultarBanner() {
    const banner = document.getElementById('app-banner');
    if (banner) banner.style.display = 'none';
  }

  function mostrarBannerActualizacion() {
    let banner = document.getElementById('update-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'update-banner';
      banner.innerHTML = `
        <span>Nueva versión disponible</span>
        <button onclick="window.location.reload()">Actualizar</button>
      `;
      banner.className = 'app-banner banner-update';
      document.body.prepend(banner);
    }
    banner.style.display = 'flex';
  }

  function mostrarToast(mensaje, tipo = 'info') {
    window.EventPassUI.mostrarToast(mensaje, tipo);
  }

  // ─── INICIALIZACIÓN ──────────────────────────────────────────
  await registrarServiceWorker();
  configurarDeteccionConexion();
  configurarInstalacion();

  console.log('[App] EventPass lista ✓');
});