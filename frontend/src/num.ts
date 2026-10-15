/** Redondea a 2 decimales (dinero). */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Redondea a 3 decimales (cantidades). */
export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;