import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { AuthInfo, TenantCtx } from '../auth/auth.types.js';
import { OnboardingDto } from './negocio.dto.js';

@Injectable()
export class NegocioService {
    constructor(private readonly db: DatabaseService) { }

    async me(auth: AuthInfo, tenant?: TenantCtx) {
        if (!tenant) return { auth, perfil: null, negocio: null };
        const negocio = await this.db.queryOne(
            `SELECT id, nombre, moneda, zona_horaria FROM negocios WHERE id = $1`,
            [tenant.negocioId],
        );
        return { auth, perfil: { usuario_id: tenant.usuarioId, rol: tenant.rol }, negocio };
    }

    /** Crea el negocio y el perfil del usuario recién registrado en Neon Auth. */
    onboard(auth: AuthInfo, dto: OnboardingDto) {
        return this.db.tx(async (c) => {
            const { rows: existe } = await c.query(
                `SELECT 1 FROM usuarios WHERE auth_user_id = $1`,
                [auth.authUserId],
            );
            if (existe.length) throw new ConflictException('Este usuario ya tiene un negocio');

            const { rows: [negocio] } = await c.query(
                `INSERT INTO negocios (nombre, moneda, zona_horaria)
         VALUES ($1, COALESCE($2, 'MXN'), COALESCE($3, 'America/Monterrey')) RETURNING *`,
                [dto.nombre_negocio, dto.moneda?.toUpperCase() ?? null, dto.zona_horaria ?? null],
            );
            const { rows: [usuario] } = await c.query(
                `INSERT INTO usuarios (auth_user_id, negocio_id, rol)
         VALUES ($1, $2, 'propietario') RETURNING id, rol`,
                [auth.authUserId, negocio.id],
            );
            return { negocio, perfil: { usuario_id: usuario.id, rol: usuario.rol } };
        });
    }
}