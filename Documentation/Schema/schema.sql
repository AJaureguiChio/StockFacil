-- =====================================================
-- Plataforma de inventario y ventas para pequeñas tiendas
-- PostgreSQL (Neon) + Neon Auth (Better Auth) | Multi-negocio
-- v3: usuarios ligados a Neon Auth (neon_auth."user", id UUID)
-- =====================================================

-- ---------- TIPOS ----------
CREATE TYPE rol_usuario     AS ENUM ('propietario', 'empleado');
CREATE TYPE tipo_movimiento AS ENUM (
  'entrada_compra',    -- llegada de mercancía
  'entrada_ajuste',    -- corrección positiva / conteo físico
  'entrada_anulacion', -- reingreso por venta anulada
  'salida_venta',      -- venta
  'salida_ajuste',     -- merma, pérdida, caducidad
  'salida_devolucion'  -- devolución a proveedor
);
CREATE TYPE estado_venta    AS ENUM ('completada', 'anulada');
CREATE TYPE metodo_pago     AS ENUM ('efectivo', 'tarjeta', 'transferencia', 'otro');

-- ---------- NEGOCIOS Y USUARIOS ----------
CREATE TABLE negocios (
  id           BIGSERIAL PRIMARY KEY,
  nombre       VARCHAR(150) NOT NULL,
  moneda       CHAR(3)      NOT NULL DEFAULT 'MXN',
  zona_horaria VARCHAR(50)  NOT NULL DEFAULT 'America/Monterrey',
  creado_en    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Perfil de aplicación. Nombre, correo y contraseña viven en Neon Auth (esquema neon_auth).
-- auth_user_id = neon_auth."user".id. Requiere tener Neon Auth habilitado ANTES de migrar.
CREATE TABLE usuarios (
  id           BIGSERIAL PRIMARY KEY,
  auth_user_id UUID        NOT NULL UNIQUE REFERENCES neon_auth."user"(id),
  negocio_id   BIGINT      NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  rol          rol_usuario NOT NULL DEFAULT 'propietario',
  activo       BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usuarios_negocio ON usuarios(negocio_id);

-- ---------- CATÁLOGO ----------
CREATE TABLE categorias (
  id         BIGSERIAL PRIMARY KEY,
  negocio_id BIGINT       NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre     VARCHAR(100) NOT NULL,
  UNIQUE (negocio_id, nombre)
);

CREATE TABLE proveedores (
  id         BIGSERIAL PRIMARY KEY,
  negocio_id BIGINT       NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre     VARCHAR(150) NOT NULL,
  telefono   VARCHAR(30),
  email      VARCHAR(255),
  activo     BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_proveedores_negocio ON proveedores(negocio_id);

CREATE TABLE productos (
  id             BIGSERIAL PRIMARY KEY,
  negocio_id     BIGINT        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  categoria_id   BIGINT        REFERENCES categorias(id) ON DELETE SET NULL,
  proveedor_id   BIGINT        REFERENCES proveedores(id) ON DELETE SET NULL,
  sku            VARCHAR(60)   NOT NULL,
  nombre         VARCHAR(200)  NOT NULL,
  descripcion    TEXT,
  precio_costo   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (precio_costo >= 0),
  precio_venta   NUMERIC(12,2) NOT NULL CHECK (precio_venta >= 0),
  stock_actual   NUMERIC(12,3) NOT NULL DEFAULT 0,   -- se mantiene vía movimientos
  stock_minimo   NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  activo         BOOLEAN       NOT NULL DEFAULT TRUE, -- baja lógica, no borrar
  creado_en      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, sku),
  CHECK (stock_actual >= 0)  -- impide vender más de lo disponible
);
CREATE INDEX idx_productos_negocio_nombre ON productos(negocio_id, nombre);
CREATE INDEX idx_productos_stock_bajo ON productos(negocio_id)
  WHERE activo AND stock_actual <= stock_minimo;

-- ---------- VENTAS ----------
CREATE TABLE ventas (
  id          BIGSERIAL PRIMARY KEY,
  negocio_id  BIGINT        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id  BIGINT        NOT NULL REFERENCES usuarios(id),
  fecha       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  metodo_pago metodo_pago   NOT NULL DEFAULT 'efectivo',
  subtotal    NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado      estado_venta  NOT NULL DEFAULT 'completada',
  notas       TEXT
);
CREATE INDEX idx_ventas_negocio_fecha ON ventas(negocio_id, fecha);

CREATE TABLE venta_detalles (
  id              BIGSERIAL PRIMARY KEY,
  venta_id        BIGINT        NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id     BIGINT        NOT NULL REFERENCES productos(id),
  cantidad        NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL,  -- precio al momento de vender
  costo_unitario  NUMERIC(12,2) NOT NULL,  -- costo al momento (para calcular utilidad)
  subtotal        NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);
CREATE INDEX idx_detalles_venta    ON venta_detalles(venta_id);
CREATE INDEX idx_detalles_producto ON venta_detalles(producto_id);

-- ---------- KARDEX: ENTRADAS Y SALIDAS ----------
CREATE TABLE movimientos_inventario (
  id             BIGSERIAL PRIMARY KEY,
  negocio_id     BIGINT          NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  producto_id    BIGINT          NOT NULL REFERENCES productos(id),
  usuario_id     BIGINT          REFERENCES usuarios(id),
  venta_id       BIGINT          REFERENCES ventas(id),
  proveedor_id   BIGINT          REFERENCES proveedores(id),
  tipo           tipo_movimiento NOT NULL,
  cantidad       NUMERIC(12,3)   NOT NULL CHECK (cantidad > 0), -- siempre positiva; el tipo define el signo
  costo_unitario NUMERIC(12,2),
  motivo         TEXT,
  fecha          TIMESTAMPTZ     NOT NULL DEFAULT now()
);
CREATE INDEX idx_mov_producto_fecha ON movimientos_inventario(producto_id, fecha);
CREATE INDEX idx_mov_negocio_fecha  ON movimientos_inventario(negocio_id, fecha);

-- ---------- ALERTAS ----------
CREATE TABLE alertas (
  id               BIGSERIAL PRIMARY KEY,
  negocio_id       BIGINT        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  producto_id      BIGINT        NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  mensaje          TEXT          NOT NULL,
  stock_al_generar NUMERIC(12,3) NOT NULL,
  leida            BOOLEAN       NOT NULL DEFAULT FALSE,  -- FALSE = pendiente
  creada_en        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
-- Una sola alerta pendiente por producto (evita acumular avisos repetidos)
CREATE UNIQUE INDEX uq_alerta_pendiente ON alertas(producto_id) WHERE NOT leida;
CREATE INDEX idx_alertas_negocio ON alertas(negocio_id, leida);

-- =====================================================
-- AUTOMATIZACIÓN
-- =====================================================

-- 1) Cada movimiento actualiza el stock y dispara alerta si baja del mínimo.
CREATE OR REPLACE FUNCTION fn_aplicar_movimiento() RETURNS TRIGGER AS $$
DECLARE
  delta NUMERIC(12,3);
  p     productos%ROWTYPE;
BEGIN
  delta := CASE WHEN NEW.tipo::text LIKE 'entrada%' THEN NEW.cantidad ELSE -NEW.cantidad END;

  UPDATE productos
     SET stock_actual   = stock_actual + delta,
         actualizado_en = now()
   WHERE id = NEW.producto_id
   RETURNING * INTO p;   -- si el stock queda < 0, el CHECK aborta la transacción

  IF delta < 0 AND p.stock_actual <= p.stock_minimo THEN
    INSERT INTO alertas (negocio_id, producto_id, mensaje, stock_al_generar)
    VALUES (p.negocio_id, p.id,
            'Stock bajo: "' || p.nombre || '" (quedan ' || trim_scale(p.stock_actual) || ')',
            p.stock_actual)
    ON CONFLICT DO NOTHING;
  ELSIF delta > 0 AND p.stock_actual > p.stock_minimo THEN
    UPDATE alertas SET leida = TRUE WHERE producto_id = p.id AND NOT leida;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aplicar_movimiento
AFTER INSERT ON movimientos_inventario
FOR EACH ROW EXECUTE FUNCTION fn_aplicar_movimiento();

-- 2) Cada línea de venta genera su salida de inventario.
CREATE OR REPLACE FUNCTION fn_salida_por_venta() RETURNS TRIGGER AS $$
DECLARE v ventas%ROWTYPE;
BEGIN
  SELECT * INTO v FROM ventas WHERE id = NEW.venta_id;
  INSERT INTO movimientos_inventario
    (negocio_id, producto_id, usuario_id, venta_id, tipo, cantidad, costo_unitario)
  VALUES
    (v.negocio_id, NEW.producto_id, v.usuario_id, v.id, 'salida_venta',
     NEW.cantidad, NEW.costo_unitario);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_salida_por_venta
AFTER INSERT ON venta_detalles
FOR EACH ROW EXECUTE FUNCTION fn_salida_por_venta();

-- =====================================================
-- REPORTES BÁSICOS (vistas)
-- =====================================================

-- Ventas por día
CREATE VIEW v_ventas_diarias AS
SELECT negocio_id,
       date_trunc('day', fecha)::date AS dia,
       COUNT(*)   AS num_ventas,
       SUM(total) AS total_vendido
FROM ventas
WHERE estado = 'completada'
GROUP BY negocio_id, date_trunc('day', fecha);

-- Utilidad y unidades por producto
CREATE VIEW v_desempeno_productos AS
SELECT p.negocio_id, p.id AS producto_id, p.nombre,
       SUM(d.cantidad)                                 AS unidades_vendidas,
       SUM(d.subtotal)                                 AS ingresos,
       SUM(d.subtotal - d.cantidad * d.costo_unitario) AS utilidad
FROM venta_detalles d
JOIN ventas v    ON v.id = d.venta_id AND v.estado = 'completada'
JOIN productos p ON p.id = d.producto_id
GROUP BY p.negocio_id, p.id, p.nombre;

-- Productos por agotarse
CREATE VIEW v_stock_bajo AS
SELECT negocio_id, id AS producto_id, nombre, stock_actual, stock_minimo
FROM productos
WHERE activo AND stock_actual <= stock_minimo;

-- Valor del inventario
CREATE VIEW v_valor_inventario AS
SELECT negocio_id,
       SUM(stock_actual * precio_costo) AS valor_costo,
       SUM(stock_actual * precio_venta) AS valor_venta
FROM productos WHERE activo
GROUP BY negocio_id;
