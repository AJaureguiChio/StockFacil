import { IsOptional, IsString, Length, MaxLength, IsEmail } from "class-validator";

export class CreateCategoriaDto {
    @IsString()
    @Length(1, 100)
    nombre: string;
}

export class CreateProveedorDto {
    @IsString()
    @Length(1, 150)
    nombre:string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    telefono?: string;

    @IsOptional()
    @IsEmail()
    email?: string;
}