// ============================================================
// registro.js — Lógica de la página Inscripción / Registro
// ============================================================

const STORAGE_ASISTENTES = 'eventpass_asistentes_local';

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

function guardarAsistentesLocales(lista) {
  localStorage.setItem(STORAGE_ASISTENTES, JSON.stringify(lista));
}

document.addEventListener('DOMContentLoaded', () => {
  const formRegistro = document.getElementById('form-registro');
  const contenedorResultado = document.getElementById('resultado-registro');

  const ticketNombre = document.getElementById('ticket-nombre');
  const ticketEmpresa = document.getElementById('ticket-empresa');
  const ticketCodigo = document.getElementById('ticket-codigo');
  const canvasQR = document.getElementById('ticket-qr-canvas');

  const btnDescargar = document.getElementById('btn-descargar');
  const btnOtro = document.getElementById('btn-otro');

  const params = new URLSearchParams(window.location.search);
  let eventoId = params.get('eventoId') || localStorage.getItem('eventpass_evento_activo');

  if (!eventoId) {
    eventoId = 'evento-local-demo';
    localStorage.setItem('eventpass_evento_activo', eventoId);
  }

  async function dibujarQR(qrCode) {
    if (!canvasQR) return;

    if (window.EventPassQR && typeof EventPassQR.generarEnCanvas === 'function') {
      await EventPassQR.generarEnCanvas(qrCode, 'ticket-qr-canvas');
      return;
    }

    if (window.QRCode && canvasQR) {
      QRCode.toCanvas(canvasQR, qrCode, {
        width: 180,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M'
      }, (err) => {
        if (err) console.error('[QR] Error generando canvas:', err);
      });
    }
  }

  if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const inputNombre = document.getElementById('nombre');
      const inputEmail = document.getElementById('email');
      const inputEmpresa = document.getElementById('empresa');

      const nombre = inputNombre ? inputNombre.value.trim() : '';
      const email = inputEmail ? inputEmail.value.trim() : '';
      const empresa = inputEmpresa ? inputEmpresa.value.trim() : '';

      if (!nombre || !email) {
        toast('Completa nombre y correo para generar el pase.', 'error');
        return;
      }

      const asistentes = leerAsistentesLocales();
      const emailNormalizado = email.toLowerCase();
      const duplicado = asistentes.some((a) => (a.email || '').toLowerCase() === emailNormalizado);

      if (duplicado) {
        toast('Este correo ya está inscrito. No se puede registrar dos veces.', 'error');
        return;
      }

      const btnSubmit = document.getElementById('btn-registrar');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Generando pase...';
      }

      const qrCode = 'EP-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      const nuevo = {
        id: 'local-' + Date.now(),
        eventoId,
        nombre,
        email,
        empresa,
        codigo: qrCode,
        checkin: false,
        fechaCheckin: null,
        creadoEn: new Date().toISOString()
      };

      asistentes.push(nuevo);
      guardarAsistentesLocales(asistentes);

      if (typeof EventPassAPI !== 'undefined' && EventPassAPI.asistentes) {
        EventPassAPI.asistentes.registrar(eventoId, { nombre, email, empresa, qrCode })
          .catch((err) => {
            console.warn('[Registro] API no respondió, operando en modo local:', err.message);
          });
      }

      await dibujarQR(qrCode);

      if (ticketNombre) ticketNombre.textContent = nombre;
      if (ticketEmpresa) ticketEmpresa.textContent = empresa || 'Asistente General';
      if (ticketCodigo) ticketCodigo.textContent = qrCode;

      formRegistro.style.display = 'none';
      if (contenedorResultado) contenedorResultado.style.display = 'block';

      toast('Pase generado y guardado en este dispositivo.', 'success');

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Generar mi pase';
      }
    });
  }

  if (btnOtro) {
    btnOtro.addEventListener('click', (e) => {
      e.preventDefault();
      if (formRegistro) {
        formRegistro.reset();
        formRegistro.style.display = 'flex';
      }
      if (contenedorResultado) {
        contenedorResultado.style.display = 'none';
      }
    });
  }

  if (btnDescargar) {
    btnDescargar.addEventListener('click', (e) => {
      e.preventDefault();
      if (!canvasQR) return;

      const enlace = document.createElement('a');
      enlace.download = `Pase-${ticketCodigo ? ticketCodigo.textContent : 'EventPass'}.png`;
      enlace.href = canvasQR.toDataURL('image/png');
      enlace.click();
    });
  }
});
