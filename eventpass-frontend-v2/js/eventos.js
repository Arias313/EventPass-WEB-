// ============================================================
// eventos.js — Lógica de la página "Mis eventos"
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Exige sesión de admin
  if (!EventPassAPI.auth.estaAutenticado()) {
    window.location.href = 'login.html';
    return;
  }

  const grid = document.getElementById('eventos-grid');
  const vacio = document.getElementById('eventos-vacio');
  const modal = document.getElementById('modal-evento');
  const formEvento = document.getElementById('form-evento');
  const elError = document.getElementById('evento-error');

  // ─── Cargar y renderizar eventos ────────────────────────
  async function cargarEventos() {
    grid.innerHTML = `<p style="color:var(--text-faint);">Cargando tus eventos...</p>`;
    try {
      const eventos = await EventPassAPI.eventos.listarMisEventos();
      renderEventos(eventos);
    } catch (error) {
      grid.innerHTML = '';
      vacio.style.display = 'block';
      vacio.querySelector('p').textContent = `No se pudieron cargar tus eventos: ${error.message}`;
    }
  }

  function renderEventos(eventos) {
    if (eventos.length === 0) {
      grid.innerHTML = '';
      vacio.style.display = 'block';
      return;
    }

    vacio.style.display = 'none';
    grid.innerHTML = eventos.map(evento => `
      <div class="evento-card" data-id="${evento._id}">
        <div class="evento-info">
          <h3>${evento.nombre}</h3>
          <p class="evento-meta">
            <span>${formatearFecha(evento.fecha)}</span>${evento.ubicacion ? `<span>${evento.ubicacion}</span>` : ''}
          </p>
          <div class="evento-conteo">
            <span><strong>${evento.registrados}</strong> registrados</span>
            <span><strong>${evento.confirmados}</strong> check-in</span>
          </div>
        </div>
        <div class="evento-acciones">
          <a href="registro.html?eventoId=${evento._id}">Ver inscripción</a>
          <a href="scanner.html?eventoId=${evento._id}">Abrir scanner</a>
          <a href="dashboard.html?eventoId=${evento._id}">Ver dashboard</a>
          <button data-accion="eliminar" data-id="${evento._id}">Eliminar</button>
        </div>
      </div>
    `).join('');
  }

  function formatearFecha(fechaISO) {
    return new Date(fechaISO).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ─── Eliminar evento ─────────────────────────────────────
  grid.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-accion="eliminar"]');
    if (!btn) return;

    const tarjeta = btn.closest('.evento-card');
    const nombre = tarjeta.querySelector('h3').textContent;
    if (!window.confirm(`¿Eliminar "${nombre}"? Esto también borra a sus asistentes.`)) return;

    btn.disabled = true;
    btn.textContent = 'Eliminando...';
    try {
      await EventPassAPI.eventos.eliminar(btn.dataset.id);
      tarjeta.remove();
      if (!grid.querySelector('.evento-card')) vacio.style.display = 'block';
    } catch (error) {
      alert(`No se pudo eliminar: ${error.message}`);
      btn.disabled = false;
      btn.textContent = 'Eliminar';
    }
  });

  // ─── Modal: crear evento ─────────────────────────────────
  document.getElementById('btn-nuevo-evento').addEventListener('click', () => abrirModal());
  document.getElementById('btn-cancelar-evento').addEventListener('click', () => cerrarModal());
  modal.addEventListener('click', (event) => { if (event.target === modal) cerrarModal(); });

  function abrirModal() {
    formEvento.reset();
    document.getElementById('evento-capacidad').value = 300;
    elError.style.display = 'none';
    modal.classList.add('is-abierto');
    document.getElementById('evento-nombre').focus();
  }

  function cerrarModal() {
    modal.classList.remove('is-abierto');
  }

  formEvento.addEventListener('submit', async (event) => {
    event.preventDefault();
    elError.style.display = 'none';

    const btn = document.getElementById('btn-guardar-evento');
    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
      await EventPassAPI.eventos.crear({
        nombre: document.getElementById('evento-nombre').value,
        fecha: document.getElementById('evento-fecha').value,
        ubicacion: document.getElementById('evento-ubicacion').value,
        capacidad: Number(document.getElementById('evento-capacidad').value)
      });
      cerrarModal();
      await cargarEventos();
    } catch (error) {
      elError.textContent = error.message;
      elError.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Crear evento';
    }
  });

  // ─── Cerrar sesión ───────────────────────────────────────
  document.getElementById('btn-cerrar-sesion').addEventListener('click', (event) => {
    event.preventDefault();
    EventPassAPI.auth.cerrarSesion();
    window.location.href = 'login.html';
  });

  cargarEventos();
});
