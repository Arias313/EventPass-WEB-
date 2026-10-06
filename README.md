# EventPass

EventPass es una aplicación web para gestionar eventos, registrar asistentes y validar sus
pases. El repositorio contiene un frontend estático en Vanilla JS y una API REST en Express
con MongoDB/Mongoose.

## Funcionalidad

- Landing pública y páginas informativas responsivas.
- Registro e inicio de sesión de administradores; el frontend conserva el estado de sesión
  en `sessionStorage` y envía el token JWT a la API.
- Consola privada para crear, listar y eliminar eventos, ver asistentes y estadísticas.
- Auto-registro público de asistentes, emisión de PIN y consulta de pases.
- Validación de check-in en la API y endpoint de sincronización por lotes.
- Manifest y Service Worker para instalación y caché de recursos estáticos.

## Estructura

- `eventpass-frontend-v2/`: páginas HTML, CSS, JavaScript y recursos de la PWA.
- `eventpass-backend/`: API Express, modelos Mongoose, controladores, rutas y middleware.

## Ejecución local

1. Instala MongoDB localmente o prepara una base de datos MongoDB accesible.
2. En `eventpass-backend/`, crea un archivo `.env` local con `MONGODB_URI`, `JWT_SECRET`,
   `JWT_EXPIRES_IN` (opcional, por defecto `7d`), `PORT` (opcional, por defecto `4000`) y
   `CORS_ORIGIN` (orígenes separados por coma; configura el origen del servidor frontend).
   No publiques ese archivo ni incluyas secretos en el repositorio.
3. Instala y ejecuta el backend:

   ```powershell
   cd eventpass-backend
   npm install
   npm run dev
   ```

4. Configura `API_BASE` en `eventpass-frontend-v2/js/config.js` para que apunte a la API
   local o desplegada. Sirve `eventpass-frontend-v2/` por HTTP, por ejemplo con la extensión
   Live Server de VS Code; no abras la aplicación con `file://`, porque los Service Workers
   requieren un origen HTTP(S).

El backend expone `GET /api/health` para comprobar que el servicio responde. La referencia
completa de rutas y modelos está en [eventpass-backend/README.md](./eventpass-backend/README.md).

## Estado y limitaciones conocidas

- El endpoint de sincronización de check-ins existe en el backend; la cola y sincronización
  offline del lado del cliente aún requieren integración y pruebas.
- Se añadió `eventpass-frontend-v2/js/qrcode.min.js` como generador local, pero su matriz QR no
  está validada con un lector estándar: la implementación reserva 16 bytes fijos y no genera los
  codewords de corrección de errores requeridos; los PIN actuales son más largos. Además, el
  dashboard y la página del ticket cargan después la librería CDN, que reemplaza la local, y la ruta
  relativa del script local del ticket es incorrecta. El Service Worker tampoco precarga el asset
  local. No considerar la generación QR ni el uso offline listos para PR.
- Ante errores de API, `crearEvento` y `registrar` pueden guardar un resultado local y devolver
  éxito al usuario; actualmente no hay una cola cliente que reconcilie esos datos con el backend.
- La API devuelve datos personales en la consulta pública de pases; el Service Worker también
  conserva algunas respuestas GET de API en CacheStorage y el cliente persiste asistentes en
  `localStorage`. Revisar minimización de datos y aislamiento/borrado de cachés al cerrar sesión.
- La consulta pública de un pase debe revisarse para limitar los datos personales que devuelve.
- La marca de sesión del frontend es solo estado visual; las operaciones privadas deben seguir
  protegidas por JWT en el backend.
- `npm run seed` requiere `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`, crea datos de demostración
  y se bloquea si `NODE_ENV=production`. Úsalo únicamente con una base local de desarrollo.

## Cierre de actividad — 6 de octubre de 2026

- Se conectaron los flujos del frontend con la API para autenticación, eventos y asistentes.
- Se centralizaron estilos de la página principal y se actualizaron las acciones de autenticación
  del header y el sidebar.
- Se incorporaron validaciones de estado de red y de errores al solicitar el renderizado del QR.
- Se revisaron backend y frontend antes del PR. La comprobación de sintaxis de los scripts
  JavaScript y `git diff --check` pasó; no hay una suite de pruebas automatizadas configurada.
- Como seguimiento quedan evitar éxitos locales ante errores HTTP, corregir y validar el generador
  QR local, retirar las referencias CDN duplicadas y cachear el asset local, añadir pruebas
  end-to-end, proteger los datos de pases/cache y completar la sincronización offline del cliente.
- Se quitaron credenciales demo del frontend y el seed ya no incluye una contraseña fija.
