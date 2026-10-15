import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { DateRangeDto, resolveRange, round2 } from '../common/dto.js';
import { ReporteVentasDto, TopProductosDto } from './reportes.dto.js';

// Traducción de lo que manda el cliente a lo que entiende date_trunc de Postgres
const TRUNC = { dia: 'day', semana: 'week', mes: 'month' } as const;

@Injectable()
export class ReportesService {
    constructor(private readonly db: DatabaseService) { }

    /** Ventas agrupadas por día/semana/mes, en la zona horaria del negocio. */
    ventas(t: TenantCtx, q: ReporteVentasDto) {
        const { desde, hasta } = resolveRange(q);
        return this.db.query(
            `SELECT date_trunc($4::text, v.fecha AT TIME ZONE n.zona_horaria)::date AS periodo,
              COUNT(*) AS num_ventas, SUM(v.total) AS total_vendido
         FROM ventas v JOIN negocios n ON n.id = v.negocio_id
        WHERE v.negocio_id = $1 AND v.estado = 'completada'
          AND v.fecha >= $2::timestamptz AND v.fecha < $3::timestamptz
        GROUP BY 1 ORDER BY 1`,
            [t.negocioId, desde, hasta, TRUNC[q.agrupar ?? 'dia']],
        );
    }

    /** Tarjetas del panel: totales del periodo + estado del inventario. */
    async resumen(t: TenantCtx, q: DateRangeDto) {
        const { desde, hasta } = resolveRange(q);
        const ventas = await this.db.queryOne(
            `SELECT COUNT(*) AS num_ventas, COALESCE(SUM(total),0) AS total_vendido,
              COALESCE(AVG(total),0) AS ticket_promedio, COALESCE(SUM(descuento),0) AS descuentos
         FROM ventas
        WHERE negocio_id = $1 AND estado = 'completada'
          AND fecha >= $2::timestamptz AND fecha < $3::timestamptz`,
            [t.negocioId, desde, hasta],
        );
        const margen = await this.db.queryOne(
            `SELECT COALESCE(SUM(d.subtotal - d.cantidad * d.costo_unitario),0) AS utilidad_bruta
         FROM venta_detalles d JOIN ventas v ON v.id = d.venta_id
        WHERE v.negocio_id = $1 AND v.estado = 'completada'
          AND v.fecha >= $2::timestamptz AND v.fecha < $3::timestamptz`,
            [t.negocioId, desde, hasta],
        );
        const inv = await this.inventario(t);
        return {
            periodo: { desde, hasta },
            ...ventas,
            utilidad: round2((margen?.utilidad_bruta ?? 0) - (ventas?.descuentos ?? 0)),
            inventario: inv,
        };
    }

    topProductos(t: TenantCtx, q: TopProductosDto) {
        const { desde, hasta } = resolveRange(q);
        return this.db.query(
            `SELECT p.id AS producto_id, p.nombre, SUM(d.cantidad) AS unidades, SUM(d.subtotal) AS ingresos,
              SUM(d.subtotal - d.cantidad * d.costo_unitario) AS utilidad
         FROM venta_detalles d
         JOIN ventas v ON v.id = d.venta_id AND v.estado = 'completada'
         JOIN productos p ON p.id = d.producto_id
        WHERE v.negocio_id = $1 AND v.fecha >= $2::timestamptz AND v.fecha < $3::timestamptz
        GROUP BY p.id, p.nombre ORDER BY unidades DESC LIMIT $4`,
            [t.negocioId, desde, hasta, q.limit ?? 10],
        );
    }

    inventario(t: TenantCtx) {
        return this.db.queryOne(
            `SELECT COUNT(*) AS productos_activos,
              COUNT(*) FILTER (WHERE stock_actual <= stock_minimo) AS productos_stock_bajo,
              COALESCE(SUM(stock_actual * precio_costo),0) AS valor_costo,
              COALESCE(SUM(stock_actual * precio_venta),0) AS valor_venta
         FROM productos WHERE negocio_id = $1 AND activo`,
            [t.negocioId],
        );
    }
}