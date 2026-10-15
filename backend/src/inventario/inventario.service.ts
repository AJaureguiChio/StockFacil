import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { CreateMovimientoDto, ListMovimientosDto } from './inventario.dto.js';
import { assertCantidad } from '../common/cantidad.js';

@Injectable()
export class InventarioService {
    constructor(private readonly db: DatabaseService) { }

    /** Registra una entrada/salida manual. Los triggers actualizan stock_actual y las alertas. */
    registrar(t: TenantCtx, dto: CreateMovimientoDto) {
        return this.db.tx(async (c) => {
            // FOR UPDATE: bloquea el producto mientras dura la transacción (evita carreras)
            const { rows: [p] } = await c.query(
                `SELECT id, nombre, permite_decimales FROM productos WHERE id = $1 AND negocio_id = $2 AND activo FOR UPDATE`,
                [dto.producto_id, t.negocioId],
            );
            if (!p) throw new NotFoundException('Producto no encontrado o inactivo');
            assertCantidad(p.nombre, dto.cantidad, p.permite_decimales);

            if (dto.proveedor_id !== undefined) {
                const { rows } = await c.query(`SELECT 1 FROM proveedores WHERE id = $1 AND negocio_id = $2`, [dto.proveedor_id, t.negocioId]);
                if (!rows.length) throw new BadRequestException('Proveedor inválido');
            }

            await c.query(
                `INSERT INTO movimientos_inventario
           (negocio_id, producto_id, usuario_id, proveedor_id, tipo, cantidad, costo_unitario, motivo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [t.negocioId, dto.producto_id, t.usuarioId, dto.proveedor_id ?? null, dto.tipo,
                dto.cantidad, dto.costo_unitario ?? null, dto.motivo ?? null],
            );
            const { rows: [prod] } = await c.query(
                `SELECT id, nombre, stock_actual, stock_minimo, (stock_actual <= stock_minimo) AS stock_bajo
           FROM productos WHERE id = $1`,
                [dto.producto_id],
            );
            return prod;
        });
    }

    /** Kardex: historial de movimientos, del más reciente al más antiguo. */
    list(t: TenantCtx, f: ListMovimientosDto) {
        return this.db.query(
            `SELECT m.id, m.fecha, m.tipo, m.cantidad, m.costo_unitario, m.motivo, m.venta_id,
              p.id AS producto_id, p.nombre AS producto, pr.nombre AS proveedor
         FROM movimientos_inventario m
         JOIN productos p ON p.id = m.producto_id
         LEFT JOIN proveedores pr ON pr.id = m.proveedor_id
        WHERE m.negocio_id = $1 AND ($2::bigint IS NULL OR m.producto_id = $2)
        ORDER BY m.fecha DESC, m.id DESC
        LIMIT $3`,
            [t.negocioId, f.producto_id ?? null, f.limit ?? 50],
        );
    }
}