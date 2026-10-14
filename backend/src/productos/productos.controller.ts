import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Tenant } from '../auth/auth.decorators.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { CreateProductoDto, ListProductosDto, UpdateProductoDto } from './productos.dto.js';
import { ProductosService } from './productos.service.js';

@Controller('productos')
export class ProductosController {
    constructor(private readonly service: ProductosService) { }

    @Get() list(@Tenant() t: TenantCtx, @Query() f: ListProductosDto) { return this.service.list(t, f); }
    @Get(':id') one(@Tenant() t: TenantCtx, @Param('id', ParseIntPipe) id: number) { return this.service.findOne(t, id); }
    @Post() create(@Tenant() t: TenantCtx, @Body() dto: CreateProductoDto) { return this.service.create(t, dto); }
    @Patch(':id') update(@Tenant() t: TenantCtx, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductoDto) { return this.service.update(t, id, dto); }
    @Delete(':id') remove(@Tenant() t: TenantCtx, @Param('id', ParseIntPipe) id: number) { return this.service.deactivate(t, id); }
}