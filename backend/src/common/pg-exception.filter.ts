import { ArgumentsHost, BadRequestException, Catch, ConflictException, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class PgExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const code = (exception as { code?: string })?.code;
    let mapped: HttpException | null = null;
    if (code === '23505') mapped = new ConflictException('Ya existe un registro con esos datos (¿SKU repetido?)');
    else if (code === '23514') mapped = new BadRequestException('Operación inválida: stock insuficiente o valor fuera de rango');
    else if (code === '23503') mapped = new BadRequestException('Referencia inválida: algún id no existe');
    super.catch(mapped ?? exception, host);
  }
}