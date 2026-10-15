import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api';
import type { Movimiento, Producto, Proveedor, TipoManual } from '../api';
import { useMe } from '../me-context';
import { esEntrada, fmtFecha, TIPO_LABEL, TIPOS_MANUALES } from '../movimientos';
import { btnPrimary, card, errorBox, input, label } from '../ui';
import { cantidadValida, minCantidad, stepCantidad } from '../num';

export default function Inventario() {
    const { me, money } = useMe();
    const zona = me.negocio?.zona_horaria ?? 'UTC';
    const [params] = useSearchParams();
    const productoInicial = params.get('producto') ?? '';

    const [productos, setProductos] = useState<Producto[]>([]);
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
    const [version, setVersion] = useState(0);

    // Formulario
    const [productoId, setProductoId] = useState(productoInicial);
    const [tipo, setTipo] = useState<TipoManual>('entrada_compra');
    const [cantidad, setCantidad] = useState('');
    const [costo, setCosto] = useState('');
    const [proveedorId, setProveedorId] = useState('');
    const [motivo, setMotivo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [aviso, setAviso] = useState('');
    const [error, setError] = useState('');

    // Filtro del historial
    const [filtroProducto, setFiltroProducto] = useState(productoInicial);

    useEffect(() => {
        api.proveedores().then(setProveedores).catch((e: Error) => setError(e.message));
    }, []);

    useEffect(() => {
        api.productos({ activo: true }).then(setProductos).catch((e: Error) => setError(e.message));
    }, [version]);

    useEffect(() => {
        let vigente = true;
        api
            .movimientos({ producto_id: filtroProducto ? Number(filtroProducto) : undefined, limit: 50 })
            .then((m) => { if (vigente) setMovimientos(m); })
            .catch((e: Error) => { if (vigente) setError(e.message); });
        return () => { vigente = false; };
    }, [filtroProducto, version]);

    const producto = productos.find((p) => String(p.id) === productoId);
    const pideProveedor = tipo === 'entrada_compra' || tipo === 'salida_devolucion';

    async function submit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setAviso('');
        if (!producto) { setError('Elige un producto.'); return; }
        const cant = Number(cantidad);
        if (!esEntrada(tipo) && cant > producto.stock_actual) {
            setError(`Solo hay ${producto.stock_actual} en stock de "${producto.nombre}".`);
            return;
        }
        if (!cantidadValida(cant, producto.permite_decimales)) {
            setError(
                producto.permite_decimales
                    ? 'La cantidad debe ser mayor que 0.'
                    : `"${producto.nombre}" solo admite cantidades enteras.`,
            );
            return;
        }
        setEnviando(true);
        try {
            const r = await api.registrarMovimiento({
                producto_id: producto.id,
                tipo,
                cantidad: cant,
                costo_unitario: tipo === 'entrada_compra' && costo.trim() !== '' ? Number(costo) : undefined,
                proveedor_id: pideProveedor && proveedorId ? Number(proveedorId) : undefined,
                motivo: motivo.trim() || undefined,
            });
            setAviso(`Listo. Stock de "${r.nombre}": ${r.stock_actual}${r.stock_bajo ? ' (⚠ stock bajo)' : ''}.`);
            setCantidad('');
            setCosto('');
            setMotivo('');
            setVersion((v) => v + 1);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Inventario</h1>

            <form onSubmit={submit} className={`${card} space-y-4 p-4`}>
                <h2 className="font-semibold">Registrar entrada o salida</h2>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                        <label className={label}>Producto *</label>
                        <select className={input} value={productoId} onChange={(e) => setProductoId(e.target.value)} required>
                            <option value="">Elige un producto…</option>
                            {productos.map((p) => (
                                <option key={p.id} value={p.id}>{p.nombre} ({p.sku}) · stock {p.stock_actual}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={label}>Tipo de movimiento *</label>
                        <select className={input} value={tipo} onChange={(e) => setTipo(e.target.value as TipoManual)}>
                            {TIPOS_MANUALES.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                    <div>
                        <label className={label}>Cantidad *</label>
                        <input className={input} type="number"
                            step={producto ? stepCantidad(producto.permite_decimales) : '1'}
                            min={producto ? minCantidad(producto.permite_decimales) : '1'} value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)} required />
                    </div>
                    {tipo === 'entrada_compra' && (
                        <div>
                            <label className={label}>Costo unitario</label>
                            <input className={input} type="number" step="0.01" min="0" value={costo} onChange={(e) => setCosto(e.target.value)} />
                        </div>
                    )}
                    {pideProveedor && (
                        <div>
                            <label className={label}>Proveedor</label>
                            <select className={input} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                                <option value="">Sin proveedor</option>
                                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="sm:col-span-2">
                        <label className={label}>Motivo</label>
                        <input className={input} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)}
                            placeholder={esEntrada(tipo) ? 'Ej. Pedido semanal' : 'Ej. Caducidad, producto dañado'} />
                    </div>
                </div>

                {error && <p className={errorBox}>{error}</p>}
                {aviso && <p className="rounded-md border border-border bg-muted p-3 text-sm">{aviso}</p>}

                <button className={btnPrimary} disabled={enviando}>{enviando ? 'Registrando…' : 'Registrar movimiento'}</button>
            </form>

            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">Historial de movimientos</h2>
                    <select className={`${input} w-auto max-w-xs`} value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)}>
                        <option value="">Todos los productos</option>
                        {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </div>

                <div className={`${card} overflow-x-auto`}>
                    <table className="w-full text-sm">
                        <thead className="bg-muted text-left">
                            <tr>
                                <th className="p-3">Fecha</th>
                                <th className="p-3">Producto</th>
                                <th className="p-3">Movimiento</th>
                                <th className="p-3 text-right">Cantidad</th>
                                <th className="p-3 text-right">Costo</th>
                                <th className="p-3">Proveedor</th>
                                <th className="p-3">Motivo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movimientos === null && (
                                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>
                            )}
                            {movimientos?.length === 0 && (
                                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aún no hay movimientos.</td></tr>
                            )}
                            {movimientos?.map((m) => {
                                const entra = esEntrada(m.tipo);
                                return (
                                    <tr key={m.id} className="border-t border-border">
                                        <td className="p-3 whitespace-nowrap">{fmtFecha(m.fecha, zona)}</td>
                                        <td className="p-3">{m.producto}</td>
                                        <td className="p-3">
                                            {TIPO_LABEL[m.tipo]}
                                            {m.venta_id !== null && <span className="text-muted-foreground"> · venta #{m.venta_id}</span>}
                                        </td>
                                        <td className={`p-3 text-right font-semibold ${entra ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                                            {entra ? '+' : '−'}{m.cantidad}
                                        </td>
                                        <td className="p-3 text-right">{m.costo_unitario !== null ? money(m.costo_unitario) : '—'}</td>
                                        <td className="p-3">{m.proveedor ?? '—'}</td>
                                        <td className="p-3">{m.motivo ?? ''}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-muted-foreground">Se muestran los 50 movimientos más recientes.</p>
            </section>
        </div>
    );
}