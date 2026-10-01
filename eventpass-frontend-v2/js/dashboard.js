// ============================================================
// dashboard.js — Métricas en vivo (API + localStorage)
// ============================================================

const STORAGE_ASISTENTES = 'eventpass_asistentes_local';
const STORAGE_CHECKINS = 'eventpass_checkins_pending';

function toast(mensaje, tipo) {
  if (window.EventPassUI && typeof EventPassUI.mostrarToast === 'function') {
    EventPassUI.mostrarToast(mensaje, tipo);
    return;
  }
  alert(mensaje);
}

function leerAsistentesLocales() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_ASISTENTES) || '[]');
  } catch {
    return [];
  }
}

function normalizarAsistenteLocal(a) {
  return {
    nombre: a.nombre,
    empresa: a.empresa,
    email: a.email,
    asistio: Boolean(a.checkin || a.asistio),
    checkedInAt: a.fechaCheckin || a.checkedInAt || null
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  let eventoId = params.get('eventoId') || localStorage.getItem('eventpass_evento_activo');

  if (!eventoId) {
    eventoId = 'evento-local-demo';
    localStorage.setItem('eventpass_evento_activo', eventoId);
  }

  const elNombreEvento = document.getElementById('dashboard-evento-nombre');
  const btnReset = document.getElementById('btn-reset-local');

  function pintarMetricas(asistentes, extras = {}) {
    const registrados = asistentes.length;
    const confirmados = asistentes.filter((a) => a.asistio || a.checkedInAt).length;
    const pendientes = Math.max(0, registrados - confirmados);
    const tasa = registrados > 0 ? Math.round((confirmados / registrados) * 100) : 0;
    const capacidad = extras.capacidad || Math.max(100, registrados);
    const porcentajeAforo = capacidad > 0 ? Math.min(100, Math.round((confirmados / capacidad) * 100)) : 0;

    if (elNombreEvento && extras.nombreEvento) {
      elNombreEvento.textContent = extras.nombreEvento;
    }

    const setText = (id, valor) => {
      const el = document.getElementById(id);
      if (el) el.textContent = valor;
    };

    setText('stat-registrados', registrados);
    setText('stat-confirmados', confirmados);
    setText('stat-pendientes', pendientes);
    setText('stat-tasa', `${tasa}%`);

    const elFill = document.getElementById('capacity-fill');
    if (elFill) elFill.style.width = `${porcentajeAforo}%`;

    const elTexto = document.getElementById('capacity-texto');
    if (elTexto) elTexto.textContent = `${confirmados} / ${capacidad} del aforo`;

    const elPorcentaje = document.getElementById('capacity-porcentaje');
    if (elPorcentaje) elPorcentaje.textContent = `${porcentajeAforo}%`;

    renderTabla(asistentes);
  }

  function renderTabla(asistentes) {
    const tbody = document.getElementById('tabla-checkins');
    if (!tbody) return;

    const confirmados = asistentes
      .filter((a) => a.asistio || a.checkedInAt)
      .sort((a, b) => new Date(b.checkedInAt || 0) - new Date(a.checkedInAt || 0))
      .slice(0, 8);

    if (confirmados.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="3">Aún no hay check-ins registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = confirmados.map((a) => `
      <tr>
        <td>${a.nombre}</td>
        <td>${a.empresa || '—'}</td>
        <td><time>${a.checkedInAt ? new Date(a.checkedInAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}</time></td>
      </tr>
    `).join('');
  }

  async function cargarDashboard() {
    const locales = leerAsistentesLocales().map(normalizarAsistenteLocal);
    let extras = { nombreEvento: 'Evento (modo local)', capacidad: 100 };

    const autenticado = typeof EventPassAPI !== 'undefined'
      && EventPassAPI.auth
      && EventPassAPI.auth.estaAutenticado();

    if (autenticado && eventoId) {
      try {
        const stats = await EventPassAPI.eventos.stats(eventoId);
        const listaApi = await EventPassAPI.asistentes.listar(eventoId);

        extras = {
          nombreEvento: stats.evento ? stats.evento.nombre : extras.nombreEvento,
          capacidad: stats.evento ? stats.evento.capacidad : extras.capacidad
        };

        if (listaApi && listaApi.length) {
          pintarMetricas(listaApi, extras);
          return;
        }
      } catch (error) {
        console.warn('[Dashboard] API no disponible, usando datos locales:', error.message);
        if (error.status === 401) {
          EventPassAPI.auth.cerrarSesion();
        }
      }
    }

    pintarMetricas(locales, extras);
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const confirmar = window.confirm('¿Vaciar inscritos y check-ins locales de esta demostración?');
      if (!confirmar) return;

      localStorage.removeItem(STORAGE_ASISTENTES);
      localStorage.removeItem(STORAGE_CHECKINS);
      toast('Datos locales reiniciados. El dashboard vuelve a cero.', 'success');
      cargarDashboard();
    });
  }

  await cargarDashboard();
  setInterval(cargarDashboard, 3000);
  window.addEventListener('storage', cargarDashboard);
});
