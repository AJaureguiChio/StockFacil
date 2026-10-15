import { Body, Controller, Get, Post } from '@nestjs/common';
import { Tenant } from '../auth/auth.decorators.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';
import { CreateCategoriaDto, CreateProveedorDto } from './catalogo.dto.js';

@Controller()
export class CatalogoController {
    constructor(private readonly db: DatabaseService) { }

    @Get('categorias')
    categorias(@Tenant() t: TenantCtx) {
        return this.db.query(
            `SELECT id, nombre FROM categorias WHERE negocio_id = $1 ORDER BY nombre`,
            [t.negocioId],
        );
    }

    @Post('categorias')
    crearCategoria(@Tenant() t: TenantCtx, @Body() dto: CreateCategoriaDto) {
        return this.db.queryOne(
            `INSERT INTO categorias (negocio_id, nombre) VALUES ($1, $2) RETURNING id, nombre`,
            [t.negocioId, dto.nombre],
        );
    }

    @Get('proveedores')
    proveedores(@Tenant() t: TenantCtx) {
        return this.db.query(
            `SELECT id, nombre, telefono, email, activo FROM proveedores WHERE negocio_id = $1 AND activo ORDER BY nombre`,
            [t.negocioId],
        );
    }

    @Post('proveedores')
    crearProveedor(@Tenant() t: TenantCtx, @Body() dto: CreateProveedorDto) {
        return this.db.queryOne(
            `INSERT INTO proveedores (negocio_id, nombre, telefono, email)
       VALUES ($1, $2, $3, $4) RETURNING id, nombre, telefono, email, activo`,
            [t.negocioId, dto.nombre, dto.telefono ?? null, dto.email ?? null],
        );
    }
}