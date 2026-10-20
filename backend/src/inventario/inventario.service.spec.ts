import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { TenantCtx } from '../auth/auth.types.js';
import { InventarioService } from './inventario.service.js';

const tenant: TenantCtx = { negocioId: 10, usuarioId: 20, rol: 'empleado' };

function setup() {
  const query = vi.fn();
  const client = { query };
  const db = { tx: vi.fn((callback: (transactionClient: { query: typeof query }) => Promise<unknown>) => callback(client)) };
  return { service: new InventarioService(db as unknown as DatabaseService), query };
}

describe('InventarioService.registrar', () => {
  it('busca solo productos activos del negocio y rechaza los ausentes', async () => {
    const { service, query } = setup();
    query.mockResolvedValueOnce({ rows: [] });
    await expect(service.registrar(tenant, { producto_id: 1, cantidad: 1, tipo: 'entrada_ajuste' }))
      .rejects.toThrow(NotFoundException);
    expect(query.mock.calls[0][0]).toContain('AND negocio_id = $2 AND activo FOR UPDATE');
    expect(query.mock.calls[0][1]).toEqual([1, 10]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rechaza fracciones para productos por pieza', async () => {
    const { service, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: 1, nombre: 'Pieza', permite_decimales: false }] });
    await expect(service.registrar(tenant, { producto_id: 1, cantidad: 0.5, tipo: 'entrada_ajuste' }))
      .rejects.toThrow(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rechaza proveedores ajenos antes de registrar el movimiento', async () => {
    const { service, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: 1, nombre: 'Pieza', permite_decimales: false }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(service.registrar(tenant, {
      producto_id: 1, cantidad: 1, tipo: 'entrada_ajuste', proveedor_id: 2,
    })).rejects.toThrow(BadRequestException);
    expect(query.mock.calls[1][1]).toEqual([2, 10]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('registra un movimiento válido y devuelve el stock actualizado', async () => {
    const { service, query } = setup();
    const stock = { id: 1, stock_actual: 3, stock_bajo: false };
    query.mockResolvedValueOnce({ rows: [{ id: 1, nombre: 'Pieza', permite_decimales: false }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [stock] });
    await expect(service.registrar(tenant, {
      producto_id: 1, cantidad: 2, tipo: 'entrada_ajuste', motivo: 'Conteo',
    })).resolves.toEqual(stock);
    expect(query.mock.calls[1][1]).toEqual([10, 1, 20, null, 'entrada_ajuste', 2, null, 'Conteo']);
    expect(query.mock.calls[2][1]).toEqual([1]);
  });
});
