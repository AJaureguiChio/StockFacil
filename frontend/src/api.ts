import { authClient } from './neon';

const API_URL = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
    status: number;
    code?: string;

    constructor(message: string, status: number, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

/** Devuelve el JWT que la API espera como Bearer (no el token de sesión opaco). */
async function getToken(): Promise<string | null> {
    const { data } = await authClient.getSession();
    const delSdk = data?.session?.token;
    if (delSdk && delSdk.split('.').length === 3) return delSdk; // ya es un JWT
    const res = await authClient.token();
    return res.data?.token ?? null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getToken();
    if (!token) throw new ApiError('No hay sesión activa', 401);

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
        // El backend devuelve message como texto o como lista (validación)
        const msg = Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? 'Error en la solicitud');
        throw new ApiError(msg, res.status, body?.code);
    }
    return body as T;
}

const post = (data: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(data) });

// ---- Tipos ----
export interface Me {
    auth: { authUserId: string; email?: string; name?: string };
    perfil: { usuario_id: number; rol: 'propietario' | 'empleado' } | null;
    negocio: { id: number; nombre: string; moneda: string; zona_horaria: string } | null;
}

// ---- Endpoints ----
export const api = {
    me: () => request<Me>('/me'),
    onboarding: (nombre_negocio: string) => request('/onboarding', post({ nombre_negocio })),
};
