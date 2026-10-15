/** Redondea a 2 decimales (dinero). */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Redondea a 3 decimales (cantidades). */
export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** Paso del input de cantidad según el tipo de producto. */
export const stepCantidad = (permiteDecimales: boolean) => (permiteDecimales ? '0.001' : '1');
export const minCantidad = (permiteDecimales: boolean) => (permiteDecimales ? '0.001' : '1');

/** Cantidad > 0 y, si el producto no admite decimales, entera. */
export const cantidadValida = (
    c: number, permiteDecimales: boolean) => c > 0 && (permiteDecimales || Number.isInteger(c)
);