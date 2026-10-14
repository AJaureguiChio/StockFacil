import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Tenant } from '../auth/auth.decorators.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { CreateVentaDto, ListVentasDto } from './ventas.dto.js';
import { VentasService } from './ventas.service.js';

@Controller('ventas')
export class VentasController {
    constructor(private readonly service: VentasService) { }

    @Post()
    create(@Tenant() t: TenantCtx, @Body() dto: CreateVentaDto) {
        return this.service.create(t, dto);
    }
    
    @Get() list(@Tenant() t: TenantCtx, @Query() f: ListVentasDto) {
        return this.service.list(t, f);
    }
    
    @Get(':id')
    one(@Tenant() t: TenantCtx, @Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(t, id);
    }
    
    @Patch(':id/anular')
    anular(@Tenant() t: TenantCtx, @Param('id', ParseIntPipe) id: number) {
        return this.service.anular(t, id);
    }
}