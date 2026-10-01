# EventPass Backend

API REST en Express + MongoDB/Mongoose que reemplaza el `localStorage` de la demo por una
base de datos real, con autenticación de admins (JWT) y soporte para múltiples eventos.

## Instalación

```bash
cd eventpass-backend
npm install
cp .env.example .env      # y edita MONGODB_URI / JWT_SECRET
npm run dev                # con nodemon, o: npm start
```

Necesitas un MongoDB corriendo (local con `mongod`, o un cluster de MongoDB Atlas y pegar su
URI en `MONGODB_URI`).

El servidor arranca por defecto en `http://localhost:4000`.

## Modelo de datos

- **Admin** (`models/Admin.js`): `nombre`, `email` (único), `passwordHash` (bcrypt, nunca se
  expone en las respuestas).
- **Evento** (`models/Evento.js`): `adminId` (dueño), `nombre`, `fecha`, `ubicacion`, `capacidad`.
- **Asistente** (`models/Asistente.js`): `eventoId`, `nombre`, `email`, `empresa`, `qrCode`
  (único por evento, se genera solo si no lo mandas), `estadoCheckin`, `fechaCheckin`.

## Autenticación

Todas las rutas protegidas esperan un header:

```
Authorization: Bearer <token>
```

El token se obtiene en `/api/auth/registro` o `/api/auth/login` y expira según
`JWT_EXPIRES_IN` (7 días por defecto).

## Referencia de endpoints

| Método | Ruta                                   | Auth | Descripción |
|--------|-----------------------------------------|------|-------------|
| GET    | `/api/health`                           | No   | Chequeo de salud del servidor |
| POST   | `/api/auth/registro`                    | No   | Crea una cuenta de admin, devuelve `{ token, admin }` |
| POST   | `/api/auth/login`                       | No   | Inicia sesión, devuelve `{ token, admin }` |
| GET    | `/api/auth/perfil`                      | Sí   | Datos del admin autenticado |
| POST   | `/api/eventos`                          | Sí   | Crea un evento del admin autenticado |
| GET    | `/api/eventos`                          | Sí   | Lista los eventos del admin (con conteo de asistentes) |
| GET    | `/api/eventos/:eventoId`                | No   | Datos básicos del evento (usa esto en registro/scanner/dashboard) |
| PUT    | `/api/eventos/:eventoId`                | Sí   | Edita un evento (solo su dueño) |
| DELETE | `/api/eventos/:eventoId`                | Sí   | Elimina un evento y sus asistentes |
| GET    | `/api/eventos/:eventoId/stats`          | Sí   | Estadísticas para el dashboard |
| POST   | `/api/eventos/:eventoId/asistentes`     | No   | Auto-registro de un asistente (registro.html) |
| GET    | `/api/eventos/:eventoId/asistentes`     | Sí   | Lista completa de asistentes del evento |
| POST   | `/api/eventos/:eventoId/checkin`        | Sí   | Check-in en vivo por `qrCode` (scanner.html) |
| POST   | `/api/checkin/sync`                     | Sí   | Sincroniza en lote check-ins hechos offline |

### Ejemplos rápidos

```bash
# Registro de admin
curl -X POST http://localhost:4000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Laura","email":"laura@empresa.com","password":"secreta123"}'

# Crear un evento (usa el token de la respuesta anterior)
curl -X POST http://localhost:4000/api/eventos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Demo Day 2026","fecha":"2026-11-20","ubicacion":"Medellín","capacidad":150}'

# Auto-registro de un asistente (sin token)
curl -X POST http://localhost:4000/api/eventos/<eventoId>/asistentes \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Carlos Ruiz","email":"carlos@empresa.com"}'
```

## Notas de diseño

- El check-in (`/checkin` y `/checkin/sync`) requiere token porque lo opera el staff del evento
  desde el scanner, no el público. Si prefieres que el scanner funcione sin login (un solo
  dispositivo compartido en la entrada), podemos cambiarlo por un código de evento simple en vez
  de JWT — dilo y lo ajustamos.
- `registrarAsistente` es pública a propósito: es el flujo de auto-inscripción del asistente.
- Los errores de Mongoose (validación, duplicados, IDs inválidos) se traducen a mensajes en
  español legibles en `middleware/errores.js`, en vez de exponer el stack trace crudo.
