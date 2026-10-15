import { Controller, Get, Query } from '@nestjs/common';
import { Tenant } from '../auth/auth.decorators.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { DateRangeDto } from '../common/dto.js';
import { ReporteVentasDto, TopProductosDto } from './reportes.dto.js';
import { ReportesService } from './reportes.service.js';

@Controller('reportes')
export class ReportesController {
    constructor(private readonly service: ReportesService) { }

    @Get('resumen')
    resumen(@Tenant() t: TenantCtx, @Query() q: DateRangeDto) {
        return this.service.resumen(t, q);
    }

    @Get('ventas') 
    ventas(@Tenant() t: TenantCtx, @Query() q: ReporteVentasDto) {
        return this.service.ventas(t, q);
    }
    
    @Get('productos-top') 
    top(@Tenant() t: TenantCtx, @Query() q: TopProductosDto) {
        return this.service.topProductos(t, q);
    }
    
    @Get('inventario') 
    inventario(@Tenant() t: TenantCtx) {
        return this.service.inventario(t);
    }
}