import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Movimientos manuales permitidos. Las ventas generan sus propias salidas. */
export const TIPOS_MANUALES = ['entrada_compra', 'entrada_ajuste', 'salida_ajuste', 'salida_devolucion'] as const;

export class CreateMovimientoDto {
    @IsInt() producto_id: number;
    @IsIn(TIPOS_MANUALES) tipo: (typeof TIPOS_MANUALES)[number];
    @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) cantidad: number;
    @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) costo_unitario?: number;
    @IsOptional() @IsInt() proveedor_id?: number;
    @IsOptional() @IsString() @MaxLength(500) motivo?: string;
}

export class ListMovimientosDto {
    @IsOptional() @Type(() => Number) @IsInt() producto_id?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}