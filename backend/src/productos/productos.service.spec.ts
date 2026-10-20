import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { ProductosService } from './productos.service.js';

const tenant: TenantCtx = { negocioId: 10, usuarioId: 20, rol: 'propietario' };
const newProduct = { sku: 'SKU-1', nombre: 'Pieza', precio_venta: 10 };

function setup() {
  const query = vi.fn();
  const client = { query };
  const db = {
    tx: vi.fn((callback: (transactionClient: { query: typeof query }) => Promise<unknown>) => callback(client)),
    queryOne: vi.fn(),
    query: vi.fn(),
  };
  return { service: new ProductosService(db as unknown as DatabaseService), query, db };
}

describe('ProductosService', () => {
  it('busca un producto dentro del negocio y rechaza los ausentes', async () => {
    const { service, db } = setup();
    db.queryOne.mockResolvedValueOnce(null);
    await expect(service.findOne(tenant, 1)).rejects.toThrow(NotFoundException);
    expect(db.queryOne.mock.calls[0][1]).toEqual([1, 10]);
  });

  it('rechaza una categoría de otro negocio antes de insertar', async () => {
    const { service, query } = setup();
    query.mockResolvedValueOnce({ rows: [] });
    await expect(service.create(tenant, { ...newProduct, categoria_id: 2 }))
      .rejects.toThrow(BadRequestException);
    expect(query.mock.calls[0][1]).toEqual([2, 10]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rechaza stock inicial fraccionario para un producto por pieza', async () => {
    const { service, query } = setup();
    await expect(service.create(tenant, { ...newProduct, stock_inicial: 0.5 }))
      .rejects.toThrow(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('registra el stock inicial como movimiento de inventario', async () => {
    const { service, query, db } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: 7 }] }).mockResolvedValueOnce({ rows: [] });
    db.queryOne.mockResolvedValueOnce({ id: 7, nombre: 'Pieza' });
    await expect(service.create(tenant, { ...newProduct, stock_inicial: 3 }))
      .resolves.toEqual({ id: 7, nombre: 'Pieza' });
    expect(query.mock.calls[0][1]).toEqual([10, null, null, 'SKU-1', 'Pieza', null, null, 10, null, false]);
    expect(query.mock.calls[1][1]).toEqual([10, 7, 20, 3, null]);
    expect(db.queryOne.mock.calls[0][1]).toEqual([7, 10]);
  });

  it('rechaza actualizaciones vacías sin ejecutar UPDATE', async () => {
    const { service, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ nombre: 'Pieza', stock_actual: 1, stock_minimo: 0, permite_decimales: false }] });
    await expect(service.update(tenant, 1, {})).rejects.toThrow(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rechaza la baja de productos ajenos o ausentes', async () => {
    const { service, db } = setup();
    db.queryOne.mockResolvedValueOnce(null);
    await expect(service.deactivate(tenant, 1)).rejects.toThrow(NotFoundException);
    expect(db.queryOne.mock.calls[0][1]).toEqual([1, 10]);
    expect(db.query).not.toHaveBeenCalled();
  });
});
