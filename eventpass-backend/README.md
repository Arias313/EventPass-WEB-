# EventPass Backend

API REST en Express + MongoDB/Mongoose que reemplaza el `localStorage` de la demo por una
base de datos real, con autenticación de admins (JWT) y soporte para múltiples eventos.

## Instalación

```bash
cd eventpass-backend
npm install
npm run dev                # con nodemon, o: npm start
```

Antes de iniciar, crea `eventpass-backend/.env` con al menos `MONGODB_URI` y un `JWT_SECRET`
aleatorio y privado. Opcionalmente define `PORT` (por defecto `4000`), `JWT_EXPIRES_IN`
(por defecto `7d`) y `CORS_ORIGIN` (orígenes permitidos separados por coma). No hay un archivo
`.env.example` en el repositorio; no copies valores de otro entorno ni publiques el `.env`.
Para usar `npm run seed` en desarrollo también hacen falta `SEED_ADMIN_EMAIL` y
`SEED_ADMIN_PASSWORD`; el comando se niega a ejecutarse si `NODE_ENV=production`.

Necesitas un MongoDB corriendo (local con `mongod`, o un cluster de MongoDB Atlas y pegar su
URI en `MONGODB_URI`).

El servidor arranca por defecto en `http://localhost:4000`.

## Modelo de datos

- **Admin** (`models/Admin.js`): `nombre`, `email` (único), `passwordHash` (bcrypt, nunca se
  expone en las respuestas).
- **Evento** (`models/Evento.js`): `titulo`, `fecha`, `lugar`, `aforoTotal`, `creador` (Admin),
  `registrados`.
- **Asistente** (`models/Asistente.js`): `nombre`, `cedula`, `correo`, `evento`, `pin` (único y
  autogenerado), `fechaRegistro`, además de los campos de check-in.

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
| GET    | `/api/eventos/:id`                      | No   | Detalle público del evento |
| PUT    | `/api/eventos/:eventoId`                | Sí   | Edita un evento (solo su dueño) |
| DELETE | `/api/eventos/:eventoId`                | Sí   | Elimina un evento y sus asistentes |
| GET    | `/api/eventos/:eventoId/stats`          | Sí   | Estadísticas para el dashboard |
| POST   | `/api/eventos/:eventoId/asistentes`     | No   | Auto-registro de un asistente (registro.html) |
| GET    | `/api/eventos/:eventoId/asistentes`     | Sí   | Lista completa de asistentes del evento |
| POST   | `/api/eventos/:eventoId/checkin`        | Sí   | Check-in en vivo por `qrCode` (scanner.html) |
| POST   | `/api/checkin/sync`                     | Sí   | Sincroniza en lote check-ins hechos offline |
| POST   | `/api/asistentes`                       | No   | Registra un asistente; requiere `nombre`, `cedula`, `correo` y `evento` |
| GET    | `/api/asistentes/:id`                   | No   | Consulta el pase por ObjectId o PIN |

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
curl -X POST http://localhost:4000/api/asistentes \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Carlos Ruiz","cedula":"12345678","correo":"carlos@empresa.com","evento":"<eventoId>"}'

# Consultar pase público con el ObjectId o PIN devuelto por el registro
curl http://localhost:4000/api/asistentes/<id-o-pin>
```

## Notas de diseño

- El check-in (`/checkin` y `/checkin/sync`) requiere token porque lo opera el staff del evento
  desde el scanner, no el público. Si prefieres que el scanner funcione sin login (un solo
  dispositivo compartido en la entrada), podemos cambiarlo por un código de evento simple en vez
  de JWT — dilo y lo ajustamos.
- `registrarAsistente` es pública a propósito: es el flujo de auto-inscripción del asistente.
- Los errores de Mongoose (validación, duplicados, IDs inválidos) se traducen a mensajes en
  español legibles en `middleware/errores.js`, en vez de exponer el stack trace crudo.
- `npm run seed` crea datos de demostración solo en desarrollo y usa credenciales proporcionadas
  por entorno; no ejecutes ni expongas esa cuenta en producción.
