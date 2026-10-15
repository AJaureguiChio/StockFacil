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
const patch = (data: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(data) });

// ---- Tipos ----
export interface Me {
    auth: { authUserId: string; email?: string; name?: string };
    perfil: { usuario_id: number; rol: 'propietario' | 'empleado' } | null;
    negocio: { id: number; nombre: string; moneda: string; zona_horaria: string } | null;
}

export interface Producto {
    id: number;
    sku: string;
    nombre: string;
    descripcion: string | null;
    precio_costo: number;
    precio_venta: number;
    stock_actual: number;
    stock_minimo: number;
    activo: boolean;
    categoria_id: number | null;
    categoria: string | null;
    proveedor_id: number | null;
    stock_bajo: boolean;
}
export interface Categoria { id: number; nombre: string }
export interface Proveedor { id: number; nombre: string; telefono: string | null; email: string | null; activo: boolean }

export interface ProductoCrear {
    sku: string;
    nombre: string;
    descripcion?: string;
    categoria_id?: number;
    proveedor_id?: number;
    precio_costo?: number;
    precio_venta: number;
    stock_minimo?: number;
    stock_inicial?: number;
}
/** null en categoria_id / proveedor_id quita la categoría o el proveedor. */
export interface ProductoEditar {
    sku?: string;
    nombre?: string;
    descripcion?: string;
    categoria_id?: number | null;
    proveedor_id?: number | null;
    precio_costo?: number;
    precio_venta?: number;
    stock_minimo?: number;
    activo?: boolean;
}

export type TipoManual = 'entrada_compra' | 'entrada_ajuste' | 'salida_ajuste' | 'salida_devolucion';
export type TipoMovimiento = TipoManual | 'salida_venta' | 'entrada_anulacion';

export interface Movimiento {
    id: number;
    fecha: string;
    tipo: TipoMovimiento;
    cantidad: number;
    costo_unitario: number | null;
    motivo: string | null;
    venta_id: number | null;
    producto_id: number;
    producto: string;
    proveedor: string | null;
}
export interface MovimientoCrear {
    producto_id: number;
    tipo: TipoManual;
    cantidad: number;
    costo_unitario?: number;
    proveedor_id?: number;
    motivo?: string;
}
/** Estado del producto tras registrar un movimiento. */
export interface ProductoStock { id: number; nombre: string; stock_actual: number; stock_minimo: number; stock_bajo: boolean }

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';
export interface VentaItemCrear { producto_id: number; cantidad: number; precio_unitario?: number }
export interface VentaCrear { items: VentaItemCrear[]; metodo_pago?: MetodoPago; descuento?: number; notas?: string }
export interface VentaLinea {
    id: number;
    producto_id: number;
    producto: string;
    sku: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
}
export interface VentaResumen {
    id: number;
    fecha: string;
    metodo_pago: MetodoPago;
    subtotal: number;
    descuento: number;
    total: number;
    estado: 'completada' | 'anulada';
    vendedor: string | null;
}
export interface Venta extends VentaResumen {
    negocio_id: number;
    usuario_id: number;
    notas: string | null;
    detalles: VentaLinea[];
}

export interface FiltrosProductos { q?: string; activo?: boolean; stock_bajo?: boolean }

const query = (params: Record<string, string | number | boolean | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v));
    const s = sp.toString();
    return s ? `?${s}` : '';
};

// ---- Endpoints ----
export const api = {
    me: () => request<Me>('/me'),
    onboarding: (nombre_negocio: string) => request('/onboarding', post({ nombre_negocio })),

    categorias: () => request<Categoria[]>('/categorias'),
    crearCategoria: (nombre: string) => request<Categoria>('/categorias', post({ nombre })),
    proveedores: () => request<Proveedor[]>('/proveedores'),

    productos: (f: FiltrosProductos = {}) => request<Producto[]>(`/productos${query({ ...f })}`),
    crearProducto: (p: ProductoCrear) => request<Producto>('/productos', post(p)),
    editarProducto: (id: number, p: ProductoEditar) => request<Producto>(`/productos/${id}`, patch(p)),
    desactivarProducto: (id: number) => request<{ id: number; activo: boolean }>(`/productos/${id}`, { method: 'DELETE' }),
    movimientos: (f: { producto_id?: number; limit?: number } = {}) => request<Movimiento[]>(`/inventario/movimientos${query({ ...f })}`),
    registrarMovimiento: (m: MovimientoCrear) => request<ProductoStock>('/inventario/movimientos', post(m)),
    vender: (v: VentaCrear) => request<Venta>('/ventas', post(v)),
    ventas: (f: { desde?: string; hasta?: string; limit?: number; offset?: number } = {}) => request<VentaResumen[]>(`/ventas${query({ ...f })}`),
    venta: (id: number) => request<Venta>(`/ventas/${id}`),
    anularVenta: (id: number) => request<Venta>(`/ventas/${id}/anular`, { method: 'PATCH' }),
};