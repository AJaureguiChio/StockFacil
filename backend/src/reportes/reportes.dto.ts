import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DateRangeDto } from '../common/dto.js';

export class ReporteVentasDto extends DateRangeDto {
    @IsOptional() @IsIn(['dia', 'semana', 'mes']) agrupar?: 'dia' | 'semana' | 'mes';
}

export class TopProductosDto extends DateRangeDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}