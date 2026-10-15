import { IsBoolean, IsOptional } from 'class-validator';
import { toBool } from '../common/dto.js';

export class ListAlertasDto {
    /** true (por defecto) = solo pendientes; false = todas */
    @IsOptional() @toBool() @IsBoolean() pendientes?: boolean;
}