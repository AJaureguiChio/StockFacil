import { Type } from 'class-transformer';
import {
    ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { DateRangeDto } from '../common/dto.js';

export const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia', 'otro'] as const;

export class VentaItemDto {
    @IsInt() producto_id: number;
    @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) cantidad: number;
    /** Opcional: si no se envía se usa el precio de venta actual del producto. */
    @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) precio_unitario?: number;
}

export class CreateVentaDto {
    @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => VentaItemDto) items: VentaItemDto[];
    @IsOptional() @IsIn(METODOS_PAGO) metodo_pago?: (typeof METODOS_PAGO)[number];
    @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) descuento?: number;
    @IsOptional() @IsString() @MaxLength(500) notas?: string;
}

export class ListVentasDto extends DateRangeDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}