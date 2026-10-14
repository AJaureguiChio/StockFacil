import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class OnboardingDto {
    @IsString()
    @Length(2, 150)
    nombre_negocio: string;

    @IsOptional()
    @IsString()
    @Length(3, 3)
    moneda?: string;
    
    @IsOptional()
    @IsString()
    @MaxLength(50) zona_horaria?: string;
}