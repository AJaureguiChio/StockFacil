import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Venta, VentaResumen } from '../api';
import { useMe } from '../me-context';
import { fmtFecha } from '../movimientos';
import { round2 } from '../num';
import { btn, card, errorBox, input } from '../ui';
import { METODO_LABEL } from '../ventas';

const PAGINA = 50;

const isoLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** 'YYYY-MM-DD' -> inicio de ese día en la hora del navegador. */
const inicioDia = (d: string) => new Date(`${d}T00:00:00`).toISOString();
/** Día siguiente (el servidor trata "hasta" como límite EXCLUSIVO). */
const diaSiguiente = (d: string) => {
    const x = new Date(`${d}T00:00:00`);
    x.setDate(x.getDate() + 1);
    return x.toISOString();
};

function DetalleVenta({ id, onClose }: { id: number; onClose: () => void }) {
    const { me, money } = useMe();
    const zona = me.negocio?.zona_horaria ?? 'UTC';
    const [venta, setVenta] = useState<Venta | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.venta(id).then(setVenta).catch((e: Error) => setError(e.message));
    }, [id]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className={`${card} max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6 shadow-lg`}>
                <div className="flex items-start justify-between">
                    <h2 className="text-lg font-semibold">Venta #{id}</h2>
                    <button className={btn} onClick={onClose}>Cerrar</button>
                </div>
                {error && <p className={errorBox}>{error}</p>}
                {!venta && !error && <p className="text-sm text-muted-foreground">Cargando…</p>}
                {venta && (
                    <>
                        <p className="text-sm text-muted-foreground">
                            {fmtFecha(venta.fecha, zona)} · {METODO_LABEL[venta.metodo_pago]} · {venta.vendedor ?? 'Sin nombre'}
                            {venta.estado === 'anulada' && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">Anulada</span>}
                        </p>
                        <table className="w-full text-sm">
                            <thead className="text-left text-muted-foreground">
                                <tr><th className="py-1">Producto</th><th className="py-1 text-right">Cant.</th><th className="py-1 text-right">Precio</th><th className="py-1 text-right">Importe</th></tr>
                            </thead>
                            <tbody>
                                {venta.detalles.map((d) => (
                                    <tr key={d.id} className="border-t border-border">
                                        <td className="py-2">{d.producto}<div className="font-mono text-xs text-muted-foreground">{d.sku}</div></td>
                                        <td className="py-2 text-right">{d.cantidad}</td>
                                        <td className="py-2 text-right">{money(d.precio_unitario)}</td>
                                        <td className="py-2 text-right">{money(d.subtotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <dl className="space-y-1 text-sm">
                            <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(venta.subtotal)}</dd></div>
                            {venta.descuento > 0 && <div className="flex justify-between"><dt>Descuento</dt><dd>−{money(venta.descuento)}</dd></div>}
                            <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{money(venta.total)}</dd></div>
                        </dl>
                        {venta.notas && <p className="text-sm"><span className="text-muted-foreground">Notas: </span>{venta.notas}</p>}
                    </>
                )}
            </div>
        </div>
    );
}

export default function Ventas() {
    const { me, money } = useMe();
    const zona = me.negocio?.zona_horaria ?? 'UTC';
    const hoy = new Date();
    const [desde, setDesde] = useState(() => isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 30)));
    const [hasta, setHasta] = useState(() => isoLocal(hoy));
    const [ventas, setVentas] = useState<VentaResumen[] | null>(null);
    const [hayMas, setHayMas] = useState(false);
    const [cargandoMas, setCargandoMas] = useState(false);
    const [version, setVersion] = useState(0);
    const [detalleId, setDetalleId] = useState<number | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!desde || !hasta) return;
        let vigente = true;
        api
            .ventas({ desde: inicioDia(desde), hasta: diaSiguiente(hasta), limit: PAGINA, offset: 0 })
            .then((v) => { if (vigente) { setVentas(v); setHayMas(v.length === PAGINA); setError(''); } })
            .catch((e: Error) => { if (vigente) setError(e.message); });
        return () => { vigente = false; };
    }, [desde, hasta, version]);

    async function cargarMas() {
        if (!ventas) return;
        setCargandoMas(true);
        try {
            const mas = await api.ventas({ desde: inicioDia(desde), hasta: diaSiguiente(hasta), limit: PAGINA, offset: ventas.length });
            setVentas([...ventas, ...mas]);
            setHayMas(mas.length === PAGINA);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setCargandoMas(false);
        }
    }

    async function anular(v: VentaResumen) {
        if (!confirm(`¿Anular la venta #${v.id} por ${money(v.total)}?\nEl stock de sus productos se devolverá al inventario.`)) return;
        try {
            await api.anularVenta(v.id);
            setVersion((x) => x + 1);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    const completadas = ventas?.filter((v) => v.estado === 'completada') ?? [];
    const suma = round2(completadas.reduce((s, v) => s + v.total, 0));

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Ventas</h1>

            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label className="mb-1 block text-sm font-medium">Desde</label>
                    <input className={input} type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium">Hasta</label>
                    <input className={input} type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
                </div>
                {ventas && (
                    <p className="pb-2 text-sm text-muted-foreground">
                        {completadas.length} ventas completadas · <strong className="text-foreground">{money(suma)}</strong>
                        {hayMas && ' (hay más ventas: carga más para ver el total completo)'}
                    </p>
                )}
            </div>

            {error && <p className={errorBox}>{error}</p>}

            <div className={`${card} overflow-x-auto`}>
                <table className="w-full text-sm">
                    <thead className="bg-muted text-left">
                        <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Vendedor</th>
                            <th className="p-3">Pago</th>
                            <th className="p-3 text-right">Total</th>
                            <th className="p-3">Estado</th>
                            <th className="p-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ventas === null && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>}
                        {ventas?.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No hay ventas en este periodo.</td></tr>}
                        {ventas?.map((v) => (
                            <tr key={v.id} className={`border-t border-border ${v.estado === 'anulada' ? 'opacity-60' : ''}`}>
                                <td className="p-3 font-mono">{v.id}</td>
                                <td className="p-3 whitespace-nowrap">{fmtFecha(v.fecha, zona)}</td>
                                <td className="p-3">{v.vendedor ?? '—'}</td>
                                <td className="p-3">{METODO_LABEL[v.metodo_pago]}</td>
                                <td className="p-3 text-right font-semibold">{money(v.total)}</td>
                                <td className="p-3">
                                    {v.estado === 'anulada'
                                        ? <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">Anulada</span>
                                        : 'Completada'}
                                </td>
                                <td className="space-x-2 p-3 text-right whitespace-nowrap">
                                    <button className={btn} onClick={() => setDetalleId(v.id)}>Ver</button>
                                    {v.estado === 'completada' && <button className={btn} onClick={() => void anular(v)}>Anular</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {hayMas && (
                <div className="text-center">
                    <button className={btn} disabled={cargandoMas} onClick={() => void cargarMas()}>
                        {cargandoMas ? 'Cargando…' : 'Cargar más'}
                    </button>
                </div>
            )}

            {detalleId !== null && <DetalleVenta key={detalleId} id={detalleId} onClose={() => setDetalleId(null)} />}
        </div>
    );
}