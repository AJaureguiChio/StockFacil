/** Zona válida (si la guardada no es reconocida, cae a UTC). */
export function zonaSegura(zona: string): string {
    try {
        new Intl.DateTimeFormat('es-MX', { timeZone: zona });
        return zona;
    } catch {
        return 'UTC';
    }
}

/** Día calendario ('YYYY-MM-DD') de una fecha, en la zona horaria del negocio. */
export const diaEn = (d: Date, zona: string) => d.toLocaleDateString('en-CA', { timeZone: zonaSegura(zona) });

/** Últimos n días terminando hoy (en la zona del negocio), del más antiguo al más reciente. */
export function ultimosDias(n: number, zona: string): string[] {
    const dias: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = diaEn(new Date(Date.now() - i * 86_400_000), zona);
        if (!dias.includes(d)) dias.push(d);
    }
    return dias;
}

/** Instante en que empieza el día 'YYYY-MM-DD' en la zona dada (00:00 hora del negocio). */
export function inicioDiaEn(dia: string, zona: string): Date {
    const [y, m, d] = dia.split('-').map(Number);
    const guess = Date.UTC(y, m - 1, d);
    const partes: Record<string, number> = {};
    for (const p of new Intl.DateTimeFormat('en-US', {
        timeZone: zonaSegura(zona), hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(new Date(guess))) {
        if (p.type !== 'literal') partes[p.type] = Number(p.value);
    }
    const pared = Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour, partes.minute, partes.second);
    return new Date(guess - (pared - guess));
}

/** '2026-10-14' -> '14 oct' */
export const diaCorto = (dia: string) =>
    new Date(`${dia}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });