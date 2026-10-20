import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertCantidad } from './cantidad.js';

describe('assertCantidad', () => {
  it('acepta cantidades enteras para productos por pieza', () => {
    expect(() => assertCantidad('Pieza', 2, false)).not.toThrow();
  });

  it('rechaza cantidades fraccionarias para productos por pieza', () => {
    expect(() => assertCantidad('Pieza', 0.5, false)).toThrow(BadRequestException);
  });

  it('acepta cantidades fraccionarias cuando el producto lo permite', () => {
    expect(() => assertCantidad('Peso', 0.5, true)).not.toThrow();
  });
});
