import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { VentasService } from './ventas.service.js';

const tenant: TenantCtx = { negocioId: 10, usuarioId: 20, rol: 'empleado' };
const product = { id: 1, nombre: 'Pieza', precio_venta: 10, precio_costo: 4, stock_actual: 3, permite_decimales: false };

function setup(products: object[] = [product]) {
  const query = vi.fn().mockResolvedValue({ rows: products });
  const client = { query };
  const db = {
    tx: vi.fn((callback: (transactionClient: { query: typeof query }) => Promise<unknown>) => callback(client)),
    queryOne: vi.fn().mockResolvedValue({ id: 99 }),
    query: vi.fn().mockResolvedValue([]),
  };
  return { service: new VentasService(db as unknown as DatabaseService), query, db };
}

describe('VentasService', () => {
  it('rechaza productos ajenos o inactivos antes de crear la venta', async () => {
    const { service, query } = setup([]);
    await expect(service.create(tenant, { items: [{ producto_id: 1, cantidad: 1 }] }))
      .rejects.toThrow(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([10, [1]]);
  });

  it('rechaza fracciones para productos por pieza', async () => {
    const { service, query } = setup();
    await expect(service.create(tenant, { items: [{ producto_id: 1, cantidad: 0.5 }] }))
      .rejects.toThrow(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('suma líneas repetidas antes de comprobar el stock', async () => {
    const { service, query } = setup();
    await expect(service.create(tenant, {
      items: [{ producto_id: 1, cantidad: 2 }, { producto_id: 1, cantidad: 2 }],
    })).rejects.toThrow(ConflictException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rechaza descuentos mayores al subtotal antes de insertar', async () => {
    const { service, query } = setup();
    await expect(service.create(tenant, {
      items: [{ producto_id: 1, cantidad: 1 }], descuento: 11,
    })).rejects.toThrow(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('calcula el total y registra el detalle con el precio indicado', async () => {
    const { service, query, db } = setup();
    query.mockResolvedValueOnce({ rows: [product] }).mockResolvedValueOnce({ rows: [{ id: 99 }] });
    await service.create(tenant, {
      items: [{ producto_id: 1, cantidad: 2, precio_unitario: 12 }], descuento: 1,
    });
    expect(query.mock.calls[1][1]).toEqual([10, 20, null, 24, 1, 23, null]);
    expect(query.mock.calls[2][1]).toEqual([99, 1, 2, 12, 4]);
    expect(db.queryOne).toHaveBeenCalledWith(expect.any(String), [99, 10]);
  });

  it('impide anular una venta ausente o ya anulada', async () => {
    const { service, query } = setup();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 1, estado: 'anulada' }] });
    await expect(service.anular(tenant, 1)).rejects.toThrow(NotFoundException);
    await expect(service.anular(tenant, 1)).rejects.toThrow(ConflictException);
    expect(query.mock.calls[0][1]).toEqual([1, 10]);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
