import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { toBool } from '../common/dto.js';

export class CreateProductoDto {
    @IsString() @Length(1, 60) @IsNotEmpty() sku: string;
    @IsString() @Length(1, 200) @IsNotEmpty() nombre: string;
    @IsOptional() @IsString() descripcion?: string;
    @IsOptional() @IsInt() categoria_id?: number;
    @IsOptional() @IsInt() proveedor_id?: number;
    @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) precio_costo?: number;
    @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) precio_venta: number;
    @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) stock_minimo?: number;
    /** Existencias iniciales: se registran como un movimiento en el kardex. */
    @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) stock_inicial?: number;
}

/** El stock NO se edita aquí: solo cambia con movimientos o ventas. */
export class UpdateProductoDto {
    @IsOptional() @IsString() @Length(1, 60) sku?: string;
    @IsOptional() @IsString() @Length(1, 200) nombre?: string;
    @IsOptional() @IsString() descripcion?: string;
    @IsOptional() @IsInt() categoria_id?: number;
    @IsOptional() @IsInt() proveedor_id?: number;
    @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) precio_costo?: number;
    @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) precio_venta?: number;
    @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) stock_minimo?: number;
    @IsOptional() @IsBoolean() activo?: boolean;
}

export class ListProductosDto {
    @IsOptional() @IsString() q?: string;
    @IsOptional() @toBool() @IsBoolean() activo?: boolean;
    @IsOptional() @toBool() @IsBoolean() stock_bajo?: boolean;
}