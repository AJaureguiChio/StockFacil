import type { TipoManual, TipoMovimiento } from './api';

export const TIPO_LABEL: Record<TipoMovimiento, string> = {
    entrada_compra: 'Entrada por compra',
    entrada_ajuste: 'Entrada por ajuste',
    salida_ajuste: 'Salida por merma o ajuste',
    salida_devolucion: 'Devolución a proveedor',
    salida_venta: 'Venta',
    entrada_anulacion: 'Venta anulada',
};

/** Tipos que el usuario puede registrar a mano (las ventas generan los suyos). */
export const TIPOS_MANUALES: TipoManual[] = ['entrada_compra', 'entrada_ajuste', 'salida_ajuste', 'salida_devolucion'];

export const esEntrada = (t: TipoMovimiento) => t.startsWith('entrada');

/** Fecha y hora en la zona horaria del negocio (si la zona no es válida, usa la del navegador). */
export function fmtFecha(iso: string, zona: string): string {
    const d = new Date(iso);
    try {
        return d.toLocaleString('es-MX', { timeZone: zona, dateStyle: 'short', timeStyle: 'short' });
    } catch {
        return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    }
}