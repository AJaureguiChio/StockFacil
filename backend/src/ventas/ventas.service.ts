import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { resolveRange, round2 } from '../common/dto.js';
import { CreateVentaDto, ListVentasDto } from './ventas.dto.js';
import { assertCantidad } from '../common/cantidad.js';

@Injectable()
export class VentasService {
    constructor(private readonly db: DatabaseService) { }

    /**
     * Orden: 1) ventas  2) venta_detalles. Todo en UNA transacción.
     * Al insertar cada detalle, los triggers generan la salida de inventario,
     * actualizan stock_actual y crean la alerta de stock bajo si aplica.
     */
    async create(t: TenantCtx, dto: CreateVentaDto) {
        const ventaId = await this.db.tx(async (c) => {
            const ids = [...new Set(dto.items.map((i) => i.producto_id))];
            const { rows: prods } = await c.query(
                `SELECT id, nombre, precio_venta, precio_costo, stock_actual, permite_decimales
           FROM productos WHERE negocio_id = $1 AND activo AND id = ANY($2::bigint[]) FOR UPDATE`,
                [t.negocioId, ids],
            );
            const byId = new Map<number, any>(prods.map((p) => [p.id, p]));
            if (byId.size !== ids.length) throw new BadRequestException('Algún producto no existe o está inactivo');

            // Stock suficiente (sumando líneas repetidas del mismo producto)
            for (const i of dto.items) {
                const p = byId.get(i.producto_id)!;
                assertCantidad(p.nombre, i.cantidad, p.permite_decimales);
            }
            
            const pedido = new Map<number, number>();
            for (const i of dto.items) pedido.set(i.producto_id, (pedido.get(i.producto_id) ?? 0) + i.cantidad);
            for (const [id, qty] of pedido) {
                const p = byId.get(id)!;
                if (qty > p.stock_actual) {
                    throw new ConflictException(`Stock insuficiente de "${p.nombre}" (disponible: ${p.stock_actual})`);
                }
            }

            const lineas = dto.items.map((i) => {
                const p = byId.get(i.producto_id)!;
                return {
                    producto_id: i.producto_id,
                    cantidad: i.cantidad,
                    precio: i.precio_unitario ?? p.precio_venta,
                    costo: p.precio_costo,
                };
            });
            const subtotal = round2(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0));
            const descuento = dto.descuento ?? 0;
            if (descuento > subtotal) throw new BadRequestException('El descuento no puede superar el subtotal');

            const { rows: [venta] } = await c.query(
                `INSERT INTO ventas (negocio_id, usuario_id, metodo_pago, subtotal, descuento, total, notas)
         VALUES ($1,$2,COALESCE($3,'efectivo')::metodo_pago,$4,$5,$6,$7) RETURNING id`,
                [t.negocioId, t.usuarioId, dto.metodo_pago ?? null, subtotal, descuento, round2(subtotal - descuento), dto.notas ?? null],
            );
            for (const l of lineas) {
                await c.query(
                    `INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, costo_unitario)
           VALUES ($1,$2,$3,$4,$5)`,
                    [venta.id, l.producto_id, l.cantidad, l.precio, l.costo],
                );
            }
            return venta.id as number;
        });
        return this.findOne(t, ventaId);
    }

    async findOne(t: TenantCtx, id: number) {
        const venta = await this.db.queryOne(
            `SELECT v.*, a.name AS vendedor
         FROM ventas v
         JOIN usuarios u ON u.id = v.usuario_id
         LEFT JOIN neon_auth."user" a ON a.id = u.auth_user_id
        WHERE v.id = $1 AND v.negocio_id = $2`,
            [id, t.negocioId],
        );
        if (!venta) throw new NotFoundException('Venta no encontrada');
        const detalles = await this.db.query(
            `SELECT d.id, d.producto_id, p.nombre AS producto, p.sku, d.cantidad, d.precio_unitario, d.subtotal
         FROM venta_detalles d JOIN productos p ON p.id = d.producto_id
        WHERE d.venta_id = $1 ORDER BY d.id`,
            [id],
        );
        return { ...venta, detalles };
    }

    list(t: TenantCtx, f: ListVentasDto) {
        const { desde, hasta } = resolveRange(f);
        return this.db.query(
            `SELECT v.id, v.fecha, v.metodo_pago, v.subtotal, v.descuento, v.total, v.estado, a.name AS vendedor
         FROM ventas v
         JOIN usuarios u ON u.id = v.usuario_id
         LEFT JOIN neon_auth."user" a ON a.id = u.auth_user_id
        WHERE v.negocio_id = $1 AND v.fecha >= $2::timestamptz AND v.fecha < $3::timestamptz
        ORDER BY v.fecha DESC LIMIT $4 OFFSET $5`,
            [t.negocioId, desde, hasta, f.limit ?? 50, f.offset ?? 0],
        );
    }

    /** Anula la venta y devuelve el stock con movimientos 'entrada_anulacion'. */
    async anular(t: TenantCtx, id: number) {
        await this.db.tx(async (c) => {
            const { rows: [v] } = await c.query(
                `SELECT id, estado FROM ventas WHERE id = $1 AND negocio_id = $2 FOR UPDATE`,
                [id, t.negocioId],
            );
            if (!v) throw new NotFoundException('Venta no encontrada');
            if (v.estado === 'anulada') throw new ConflictException('La venta ya estaba anulada');

            await c.query(`UPDATE ventas SET estado = 'anulada' WHERE id = $1`, [id]);
            await c.query(
                `INSERT INTO movimientos_inventario
           (negocio_id, producto_id, usuario_id, venta_id, tipo, cantidad, costo_unitario, motivo)
         SELECT $2, d.producto_id, $3, d.venta_id, 'entrada_anulacion', d.cantidad, d.costo_unitario,
                'Venta anulada #' || d.venta_id
           FROM venta_detalles d WHERE d.venta_id = $1`,
                [id, t.negocioId, t.usuarioId],
            );
        });
        return this.findOne(t, id);
    }
}