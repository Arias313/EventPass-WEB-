# EventPass — proyecto funcional

Este paquete completa las páginas que faltaban (`registro`, `dashboard`, `offline`), el
`manifest.json`, los íconos y el CSS, para que la PWA quede navegable y funcional de punta a punta.

## Cómo probarlo

Los Service Workers **no funcionan abriendo el `index.html` directamente con doble clic** (protocolo
`file://`). Necesitas servirlo desde un servidor local:

```bash
cd eventpass
python3 -m http.server 8080
```

Luego abre `http://localhost:8080` en el navegador.

## Qué quedó funcional

- **Inscripción** (`pages/registro.html`): formulario con validación, genera un código único y dibuja
  el QR del asistente en un pase descargable (PNG).
- **Dashboard** (`pages/dashboard.html`): aforo, check-ins confirmados/pendientes y tabla de últimos
  ingresos, actualizándose en vivo.
- **Offline** (`pages/offline.html`): página de respaldo que el Service Worker sirve cuando no hay red
  y no hay caché de la página pedida.
- **manifest.json** e **íconos**: para que "Instalar App" funcione en iOS/Android/desktop.

## Sobre los datos (importante)

Este proyecto se integra con un backend real en Node/Express para registrar asistentes, consultar
estadísticas y sincronizar operaciones offline mediante IndexedDB. El Service Worker ya está
configurado para no cachear esas rutas (`NEVER_CACHE`), así que no hay que tocarlo.

## Siguientes pasos sugeridos

- Contratar o mantener la autenticación del staff para el check-in en la API.
- Añadir notificaciones push reales (requieren un servidor push + claves VAPID).
