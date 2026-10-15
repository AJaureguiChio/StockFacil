import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { CreateProductoDto, ListProductosDto, UpdateProductoDto } from './productos.dto.js';
import { assertCantidad } from '../common/cantidad.js';

// Lista blanca de columnas editables (evita construir SQL con nombres que vengan del cliente)
const UPDATABLE = [
    'sku', 'nombre', 'descripcion', 'categoria_id', 'proveedor_id',
    'precio_costo', 'precio_venta', 'stock_minimo', 'activo', 'permite_decimales',
] as const;

@Injectable()
export class ProductosService {
    constructor(private readonly db: DatabaseService) { }

    list(t: TenantCtx, f: ListProductosDto) {
        return this.db.query(
            `SELECT p.id, p.sku, p.nombre, p.descripcion, p.permite_decimales, p.precio_costo, p.precio_venta, p.stock_actual,
              p.stock_minimo, p.activo, p.categoria_id, c.nombre AS categoria, p.proveedor_id,
              (p.stock_actual <= p.stock_minimo) AS stock_bajo
         FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.negocio_id = $1
          AND ($2::text IS NULL OR p.nombre ILIKE '%' || $2 || '%' OR p.sku ILIKE '%' || $2 || '%')
          AND ($3::boolean IS NULL OR p.activo = $3)
          AND (NOT COALESCE($4::boolean, false) OR p.stock_actual <= p.stock_minimo)
        ORDER BY p.nombre`,
            [t.negocioId, f.q ?? null, f.activo ?? null, f.stock_bajo ?? null],
        );
    }

    async findOne(t: TenantCtx, id: number) {
        const p = await this.db.queryOne(
            `SELECT p.*, c.nombre AS categoria
         FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.id = $1 AND p.negocio_id = $2`,
            [id, t.negocioId],
        );
        if (!p) throw new NotFoundException('Producto no encontrado');
        return p;
    }

    /** Verifica que la categoría/proveedor pertenezca al mismo negocio. */
    private async assertOwned(c: PoolClient, tabla: 'categorias' | 'proveedores', id: number | undefined, negocioId: number) {
        if (id == null) return;
        const { rows } = await c.query(`SELECT 1 FROM ${tabla} WHERE id = $1 AND negocio_id = $2`, [id, negocioId]);
        if (!rows.length) throw new BadRequestException(tabla === 'categorias' ? 'Categoría inválida' : 'Proveedor inválido');
    }

    create(t: TenantCtx, dto: CreateProductoDto) {
        return this.db
            .tx(async (c) => {
                await this.assertOwned(c, 'categorias', dto.categoria_id, t.negocioId);
                await this.assertOwned(c, 'proveedores', dto.proveedor_id, t.negocioId);

                const permite = dto.permite_decimales ?? false;
                assertCantidad(dto.nombre, dto.stock_minimo ?? 0, permite, 'El stock mínimo');
                assertCantidad(dto.nombre, dto.stock_inicial ?? 0, permite, 'El stock inicial');

                const { rows: [p] } = await c.query(
                    `INSERT INTO productos (negocio_id, categoria_id, proveedor_id, sku, nombre, descripcion, precio_costo, precio_venta, stock_minimo, permite_decimales)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,0),$8,COALESCE($9,0),$10) RETURNING id`,
                    [t.negocioId, dto.categoria_id ?? null, dto.proveedor_id ?? null, dto.sku, dto.nombre, dto.descripcion ?? null,
                    dto.precio_costo ?? null, dto.precio_venta, dto.stock_minimo ?? null, permite],
                );
                if (dto.stock_inicial && dto.stock_inicial > 0) {
                    await c.query(
                        `INSERT INTO movimientos_inventario (negocio_id, producto_id, usuario_id, tipo, cantidad, costo_unitario, motivo)
             VALUES ($1,$2,$3,'entrada_ajuste',$4,$5,'Stock inicial')`,
                        [t.negocioId, p.id, t.usuarioId, dto.stock_inicial, dto.precio_costo ?? null],
                    );
                }
                return p.id as number;
            })
            .then((id) => this.findOne(t, id));
    }

    async update(t: TenantCtx, id: number, dto: UpdateProductoDto) {
        await this.db.tx(async (c) => {
            await this.assertOwned(c, 'categorias', dto.categoria_id, t.negocioId);
            await this.assertOwned(c, 'proveedores', dto.proveedor_id, t.negocioId);
            const { rows: [cur] } = await c.query(
                `SELECT nombre, stock_actual, stock_minimo, permite_decimales FROM productos WHERE id = $1 AND negocio_id = $2 FOR UPDATE`,
                [id, t.negocioId],
            );
            if (!cur) throw new NotFoundException('Producto no encontrado');
            const permite = dto.permite_decimales ?? cur.permite_decimales;
            if (!permite) {
                assertCantidad(cur.nombre, cur.stock_actual, false, 'El stock actual');
                assertCantidad(cur.nombre, dto.stock_minimo ?? cur.stock_minimo, false, 'El stock mínimo');
            }

            // Armamos el SET solo con los campos que llegaron
            const sets: string[] = [];
            const values: unknown[] = [];
            for (const k of UPDATABLE) {
                if (dto[k] !== undefined) {
                    values.push(dto[k]);
                    sets.push(`${k} = $${values.length}`);
                }
            }
            if (!sets.length) throw new BadRequestException('Nada que actualizar');

            values.push(id, t.negocioId);
            const { rows: [p] } = await c.query(
                `UPDATE productos SET ${sets.join(', ')}, actualizado_en = now()
          WHERE id = $${values.length - 1} AND negocio_id = $${values.length}
          RETURNING id, nombre, stock_actual, stock_minimo, activo`,
                values,
            );
            if (!p) throw new NotFoundException('Producto no encontrado');

            // Los triggers solo reaccionan a movimientos: si cambió el mínimo, reevaluamos la alerta aquí.
            if (dto.stock_minimo !== undefined || dto.activo !== undefined) {
                if (p.activo && p.stock_actual <= p.stock_minimo) {
                    await c.query(
                        `INSERT INTO alertas (negocio_id, producto_id, mensaje, stock_al_generar)
             VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
                        [t.negocioId, p.id, `Stock bajo: "${p.nombre}" (quedan ${p.stock_actual})`, p.stock_actual],
                    );
                } else {
                    await c.query(`UPDATE alertas SET leida = TRUE WHERE producto_id = $1 AND NOT leida`, [p.id]);
                }
            }
        });
        return this.findOne(t, id);
    }

    /** Baja lógica: el producto tiene historial, no se borra. */
    async deactivate(t: TenantCtx, id: number) {
        const p = await this.db.queryOne(
            `UPDATE productos SET activo = FALSE, actualizado_en = now() WHERE id = $1 AND negocio_id = $2 RETURNING id`,
            [id, t.negocioId],
        );
        if (!p) throw new NotFoundException('Producto no encontrado');
        await this.db.query(`UPDATE alertas SET leida = TRUE WHERE producto_id = $1 AND NOT leida`, [id]);
        return { id, activo: false };
    }
}