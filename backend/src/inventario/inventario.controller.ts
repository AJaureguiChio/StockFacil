import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Tenant } from '../auth/auth.decorators.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { CreateMovimientoDto, ListMovimientosDto } from './inventario.dto.js';
import { InventarioService } from './inventario.service.js';

@Controller('inventario')
export class InventarioController {
    constructor(private readonly service: InventarioService) { }

    @Post('movimientos')
    registrar(@Tenant() t: TenantCtx, @Body() dto: CreateMovimientoDto) {
        return this.service.registrar(t, dto);
    }
    
    @Get('movimientos')
    list(@Tenant() t: TenantCtx, @Query() f: ListMovimientosDto) {
        return this.service.list(t, f);
    }
}