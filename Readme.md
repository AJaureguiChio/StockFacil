# StockFácil

Plataforma web de **inventario y ventas para pequeñas tiendas**: catálogo de productos, existencias en tiempo real, punto de venta, alertas de stock bajo y reportes básicos. Cada negocio tiene sus datos aislados (multi-tenant).

**Demo en vivo:** https://stock-facil-kappa.vercel.app
**API:** https://stockfacil-production.up.railway.app/api/health
**Documentación de la API:** 0yidfh38f6.apidog.io
    **Contraseña de la Documentación:** 24NgyOo9

> Proyecto personal de portafolio, construido de punta a punta: modelado de datos, API REST, interfaz, autenticación y despliegue.

![Página de Inicio](images/26-10-15_17-39-56_brave_(1360x639).png)
![Página de Ventas](images/26-10-15_17-40-22_brave_(1360x639).png)
![Página de Ventas](images/26-10-15_17-40-42_brave_(1360x639).png)
![Página de Productos](images/26-10-15_17-40-51_brave_(1360x639).png)
![Página de Inventario](images/26-10-15_17-41-20_brave_(1360x639).png)

---

## Qué hace

- **Productos:** alta, edición y baja lógica, con SKU, categoría, proveedor, precios de costo y venta, y stock mínimo.
- **Inventario con kardex:** el stock nunca se edita a mano; cambia solo mediante movimientos (compras, ajustes, mermas, devoluciones, ventas y anulaciones), todos con historial.
- **Punto de venta:** carrito, búsqueda por nombre o SKU, descuento, método de pago y validación de existencias.
- **Ventas:** historial por rango de fechas, detalle y anulación (la anulación regresa el stock).
- **Alertas de stock bajo:** se generan automáticamente y se marcan como leídas.
- **Dashboard:** ventas, ticket promedio, utilidad, ventas por día, productos más vendidos y valor del inventario.
- **Unidades enteras o decimales por producto:** los productos por pieza solo aceptan cantidades enteras; los de peso o volumen admiten hasta 3 decimales.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router |
| Backend | NestJS (ESM), TypeScript, `class-validator`, `pg` |
| Base de datos | PostgreSQL en **Neon** |
| Autenticación | **Neon Auth** (Better Auth); el backend valida el JWT con `jose` y JWKS remoto |
| Despliegue | Vercel (frontend) y Railway (backend) |
| Documentación de API | OpenAPI 3 (`openapi-api.json`) |

## Arquitectura

```
Navegador (React) ──JWT──▶ API NestJS ──SQL──▶ PostgreSQL (Neon)
        │                      │
        └──── login ───▶ Neon Auth ◀── JWKS ───┘
```

Decisiones de diseño que vale la pena destacar:

- **Aislamiento por negocio.** Todas las tablas llevan `negocio_id`; cada consulta lo filtra y los ids que llegan del cliente (categoría, proveedor, producto) se validan contra el negocio del usuario antes de usarse.
- **La integridad vive en la base de datos.** El stock se mantiene con triggers sobre `movimientos_inventario` (una venta inserta su salida automáticamente), con `CHECK (stock_actual >= 0)`. Un trigger adicional rechaza cantidades fraccionarias en productos que no las permiten, de modo que la regla se cumple aunque falle una capa superior.
- **Ventas transaccionales.** Se bloquean las filas de producto (`FOR UPDATE`), se valida el stock y se insertan venta y detalles en una sola transacción, evitando sobreventa por concurrencia.
- **Bajas lógicas, nunca borrados.** Productos con `activo = false` y ventas con `estado = 'anulada'`, para conservar el historial.
- **Guard global de autenticación** (`@Public`, `@AllowNoProfile`, `@Tenant`) que verifica el JWT, resuelve el perfil y entrega el contexto del negocio a cada controlador.
- **Validación estricta de entrada** (`whitelist` + `forbidNonWhitelisted`) y un filtro que traduce errores de PostgreSQL (23505 → 409, 23514 y 23503 → 400).
- **Dinero y cantidades exactas:** `NUMERIC(12,2)` para importes y `NUMERIC(12,3)` para cantidades.
- **Zona horaria por negocio.** Los reportes agrupan por día en la zona del negocio, no en la del servidor.

## Estructura del repositorio

```
├── backend/          API NestJS (módulos: negocio, catalogo, productos, inventario, ventas, alertas, reportes)
├── frontend/         Aplicación React
├── db/schema.sql     Esquema de PostgreSQL (tablas, enums, triggers, vistas)
├── openapi-api.json  Especificación OpenAPI de la API
└── .env.example      Variables de entorno
```

## API (resumen)

Todas las rutas llevan el prefijo `/api` y, salvo `/health`, exigen `Authorization: Bearer <JWT>`.

| Recurso | Rutas |
|---|---|
| Negocio | `GET /me`, `POST /onboarding` |
| Catálogo | `GET/POST /categorias`, `GET/POST /proveedores` |
| Productos | `GET/POST /productos`, `GET/PATCH/DELETE /productos/:id` |
| Inventario | `GET/POST /inventario/movimientos` |
| Ventas | `GET/POST /ventas`, `GET /ventas/:id`, `PATCH /ventas/:id/anular` |
| Alertas | `GET /alertas`, `PATCH /alertas/:id/leer`, `PATCH /alertas/leer-todas` |
| Reportes | `GET /reportes/resumen`, `/ventas`, `/productos-top`, `/inventario` |

La especificación completa está en [Apidgog](https://0yidfh38f6.apidog.io/) y puede importarse en Postman, Apidog o Swagger UI.

## Ejecutar en local

**Requisitos:** Node.js 22 o superior y una cuenta gratuita de [Neon](https://neon.tech).

1. **Base de datos.** Crea un proyecto en Neon, habilita **Neon Auth** y ejecuta `db/schema.sql` en el SQL Editor. Habilita Auth *antes*, porque el esquema referencia la tabla de usuarios de Neon Auth.
2. **Variables de entorno.** Copia `.env.example` a `.env` en la raíz y completa:

   | Variable | Descripción |
   |---|---|
   | `DATABASE_URL` | Cadena de conexión de Neon (con pooler) |
   | `NEON_AUTH_BASE_URL` | URL base de Neon Auth |
   | `NEON_AUTH_JWKS_URL` | Ruta del JWKS, normalmente `/.well-known/jwks.json` |
   | `FRONTEND_URL` | Origen permitido por CORS, p. ej. `http://localhost:5173` |
   | `VITE_NEON_AUTH_BASE_URL` | Misma URL de Auth, para el frontend |
   | `VITE_API_URL` | `http://localhost:3000/api` |

3. **Instalar y arrancar.**

   ```bash
   npm install
   npm run start:dev -w backend    # API en http://localhost:3000/api
   npm run dev -w frontend         # App en http://localhost:5173
   ```

4. Abre la app, regístrate y crea tu negocio en el *onboarding*.

## Despliegue

- **Backend en Railway.** Build: `npm run build -w backend`; inicio: `npm run start:prod -w backend`; *healthcheck* en `/api/health`.
- **Frontend en Vercel.** Directorio raíz `frontend`, con `vercel.json` que redirige todas las rutas a `index.html` (SPA).
- **Producción y pruebas** usan *branches* distintas de Neon, cada una con su propia instancia de Auth. El dominio del frontend se registra como origen de confianza en Neon Auth.

## Limitaciones conocidas y siguientes pasos

Documentadas a propósito, por transparencia:

- Los roles (`propietario` / `empleado`) existen en el modelo pero **aún no se aplican** en las rutas.
- Las compras no actualizan `precio_costo` del producto, por lo que la utilidad calculada puede desfasarse.
- No hay alta de proveedores desde la interfaz (el backend sí lo soporta).
- Falta paginación en el listado de productos y validación de `zona_horaria` y `moneda`.
- No hay pruebas automatizadas ni migraciones versionadas (el esquema se aplica con un script SQL).

## Autor

**Alberto Jáuregui**: [LinkedIn](#) · [GitHub](#)