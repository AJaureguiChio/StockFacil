import type { Request } from 'express';

/** Datos que vienen en el token de Neon Auth. */
export interface AuthInfo {
  authUserId: string;
  email?: string;
  name?: string;
}

/** Perfil de la app (tabla usuarios): a qué negocio pertenece. */
export interface TenantCtx {
  usuarioId: number;
  negocioId: number;
  rol: 'propietario' | 'empleado';
}

export type AuthedRequest = Request & { auth: AuthInfo; tenant?: TenantCtx };