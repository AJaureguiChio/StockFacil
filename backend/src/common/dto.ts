import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional } from 'class-validator';

/** Convierte 'true'/'false' (texto de la URL) en booleano. */
export const toBool = () =>
    Transform(({ value }) =>
        value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined,
    );

export class DateRangeDto {
    /** Inicio (inclusivo), ISO 8601. Por defecto: hace 30 días. */
    @IsOptional() @IsISO8601() desde?: string;
    /** Fin (EXCLUSIVO), ISO 8601. Por defecto: ahora. */
    @IsOptional() @IsISO8601() hasta?: string;
}

export function resolveRange(r: DateRangeDto): { desde: string; hasta: string } {
    const hasta = r.hasta ?? new Date().toISOString();
    const desde = r.desde ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
    return { desde, hasta };
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;