import { BadRequestException } from '@nestjs/common';

/** Rechaza cantidades fraccionarias si el producto no permite decimales. */
export function assertCantidad(nombre: string, cantidad: number, permiteDecimales: boolean, campo = 'La cantidad') {
    if (!permiteDecimales && !Number.isInteger(cantidad)) {
        throw new BadRequestException(`${campo} de "${nombre}" debe ser un número entero (este producto no se vende por peso/volumen)`);
    }
}