import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { DatabaseService } from '../database/database.service.js';
import { ALLOW_NO_PROFILE, IS_PUBLIC } from './auth.decorators.js';
import type { AuthedRequest } from './auth.types.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuers: string[];

  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
    config: ConfigService,
  ) {
    const base = config.getOrThrow<string>('NEON_AUTH_BASE_URL').replace(/\/$/, '');
    const jwksCfg = config.get<string>('NEON_AUTH_JWKS_URL');
    // Si la variable es una URL completa se usa tal cual; si es solo la ruta, se pega a la base.
    const jwksUrl = jwksCfg?.startsWith('http')
      ? jwksCfg
      : `${base}${jwksCfg || '/.well-known/jwks.json'}`;
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    // La doc de Neon indica el origin como issuer; aceptamos también la URL completa por si acaso.
    this.issuers = [new URL(base).origin, base];
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Falta el token de sesión');

    // 1) Verificar firma, expiración e issuer
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(header.slice(7), this.jwks, { issuer: this.issuers }));
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    if (!payload.sub || !UUID.test(payload.sub)) throw new UnauthorizedException('Token sin usuario válido');

    req.auth = {
      authUserId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };

    // 2) Buscar el perfil en nuestra tabla usuarios (de ahí sale el negocio_id)
    const perfil = await this.db.queryOne<{ id: number; negocio_id: number; rol: 'propietario' | 'empleado' }>(
      `SELECT id, negocio_id, rol FROM usuarios WHERE auth_user_id = $1 AND activo`,
      [payload.sub],
    );
    if (perfil) req.tenant = { usuarioId: perfil.id, negocioId: perfil.negocio_id, rol: perfil.rol };

    if (!perfil && !this.reflector.getAllAndOverride<boolean>(ALLOW_NO_PROFILE, targets)) {
      throw new ForbiddenException({ code: 'ONBOARDING_REQUIRED', message: 'Primero crea tu negocio' });
    }
    return true;
  }
}