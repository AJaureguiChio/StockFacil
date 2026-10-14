import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthedRequest, AuthInfo, TenantCtx } from './auth.types.js';

export const IS_PUBLIC = 'isPublic';
export const ALLOW_NO_PROFILE = 'allowNoProfile';

/** Ruta sin autenticación. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Exige token válido pero NO exige tener negocio todavía (para el onboarding). */
export const AllowNoProfile = () => SetMetadata(ALLOW_NO_PROFILE, true);

/** Identidad del token. */
export const Auth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthInfo => ctx.switchToHttp().getRequest<AuthedRequest>().auth,
);

/** Negocio y usuario de la app. Siempre presente, salvo en rutas @AllowNoProfile. */
export const Tenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantCtx =>
    ctx.switchToHttp().getRequest<AuthedRequest>().tenant as TenantCtx,
);