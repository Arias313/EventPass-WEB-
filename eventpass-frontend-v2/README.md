# EventPass — proyecto funcional

Este paquete completa las páginas que faltaban (`registro`, `scanner`, `dashboard`, `offline`), el
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
- **Scanner** (`pages/scanner.html`): abre la cámara (pide permiso), lee el QR, confirma el check-in y
  muestra el resultado (válido, repetido o no encontrado). Si no hay conexión, guarda el check-in en
  IndexedDB y lo sincroniza solo al reconectar (usa la lógica que ya tenía `app.js`).
- **Dashboard** (`pages/dashboard.html`): aforo, check-ins confirmados/pendientes y tabla de últimos
  ingresos, actualizándose en vivo.
- **Offline** (`pages/offline.html`): página de respaldo que el Service Worker sirve cuando no hay red
  y no hay caché de la página pedida.
- **manifest.json** e **íconos**: para que "Instalar App" funcione en iOS/Android/desktop.

## Sobre los datos (importante)

Este proyecto **no incluye un backend real**. Para que registro, scanner y dashboard funcionen de
forma consistente entre sí sin un servidor, se agregó `js/data-store.js`: una capa que simula la base
de datos usando `localStorage` del navegador (visible solo en ese navegador/dispositivo).

Para producción, reemplaza los métodos de `EventPassStore` por llamadas reales a tu API
(`/api/attendees`, `/api/checkin`, `/api/dashboard/live`) — el Service Worker ya está configurado
para no cachear esas rutas (`NEVER_CACHE`), así que no hay que tocarlo.

## Siguientes pasos sugeridos

- Conectar `EventPassStore` a un backend real (Node/Express, Firebase, Supabase, etc.).
- Agregar autenticación para el scanner (para que solo el staff pueda hacer check-in).
- Notificaciones push reales (requieren un servidor push + claves VAPID).
