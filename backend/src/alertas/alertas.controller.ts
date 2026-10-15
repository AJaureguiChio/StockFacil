import { Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { Tenant } from '../auth/auth.decorators.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';
import { ListAlertasDto } from './alertas.dto.js';

@Controller('alertas')
export class AlertasController {
    constructor(private readonly db: DatabaseService) { }

    @Get()
    list(@Tenant() t: TenantCtx, @Query() f: ListAlertasDto) {
        const soloPendientes = f.pendientes ?? true;
        return this.db.query(
            `SELECT a.id, a.mensaje, a.stock_al_generar, a.leida, a.creada_en,
              p.id AS producto_id, p.nombre AS producto, p.stock_actual, p.stock_minimo
         FROM alertas a JOIN productos p ON p.id = a.producto_id
        WHERE a.negocio_id = $1 AND (NOT $2::boolean OR NOT a.leida)
        ORDER BY a.creada_en DESC LIMIT 100`,
            [t.negocioId, soloPendientes],
        );
    }

    /** Marca todas las alertas pendientes como leídas. */
    @Patch('leer-todas')
    async leerTodas(@Tenant() t: TenantCtx) {
        const rows = await this.db.query(
            `UPDATE alertas SET leida = TRUE WHERE negocio_id = $1 AND NOT leida RETURNING id`,
            [t.negocioId],
        );
        return { marcadas: rows.length };
    }

    @Patch(':id/leer')
    async leer(@Tenant() t: TenantCtx, @Param('id', ParseIntPipe) id: number) {
        const a = await this.db.queryOne(
            `UPDATE alertas SET leida = TRUE WHERE id = $1 AND negocio_id = $2 RETURNING id, leida`,
            [id, t.negocioId],
        );
        if (!a) throw new NotFoundException('Alerta no encontrada');
        return a;
    }
}