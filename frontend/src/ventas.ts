import type { MetodoPago } from './api';

export const METODO_LABEL: Record<MetodoPago, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    otro: 'Otro',
};

export const METODOS = Object.keys(METODO_LABEL) as MetodoPago[];