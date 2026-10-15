import { useEffect, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { api } from '../api';
import type { MetodoPago, Producto } from '../api';
import { useMe } from '../me-context';
import { cantidadValida, minCantidad, round2, round3, stepCantidad } from '../num';
import { btn, btnPrimary, card, errorBox, input, label } from '../ui';
import { METODO_LABEL, METODOS } from '../ventas';

interface Linea {
    producto: Producto;
    cantidad: string; // texto, para poder editar el campo libremente
}

export default function Vender() {
    const { money } = useMe();
    const [q, setQ] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [productos, setProductos] = useState<Producto[] | null>(null);
    const [version, setVersion] = useState(0);

    const [carrito, setCarrito] = useState<Linea[]>([]);
    const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
    const [descuento, setDescuento] = useState('');
    const [notas, setNotas] = useState('');
    const [cobrando, setCobrando] = useState(false);
    const [error, setError] = useState('');
    const [exito, setExito] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setBusqueda(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        let vigente = true;
        api
            .productos({ q: busqueda || undefined, activo: true })
            .then((d) => { if (vigente) setProductos(d); })
            .catch((e: Error) => { if (vigente) setError(e.message); });
        return () => { vigente = false; };
    }, [busqueda, version]);

    function agregar(p: Producto) {
        if (p.stock_actual <= 0) return;
        setExito('');
        setCarrito((prev) => {
            const existente = prev.find((l) => l.producto.id === p.id);
            if (!existente) return [...prev, { producto: p, cantidad: '1' }];
            return prev.map((l) =>
                l.producto.id === p.id
                    ? { ...l, cantidad: String(Math.min(round3((Number(l.cantidad) || 0) + 1), p.stock_actual)) }
                    : l,
            );
        });
    }

    function cambiarCantidad(id: number, valor: string) {
        setCarrito((prev) => prev.map((l) => (l.producto.id === id ? { ...l, cantidad: valor } : l)));
    }

    function quitar(id: number) {
        setCarrito((prev) => prev.filter((l) => l.producto.id !== id));
    }

    // Lector de código o teclado: Enter agrega el producto cuyo SKU coincide (o el único resultado)
    async function alEnter(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const t = q.trim();
        if (!t) return;
        try {
            const lista = await api.productos({ q: t, activo: true });
            const exacto = lista.find((p) => p.sku.toLowerCase() === t.toLowerCase()) ?? (lista.length === 1 ? lista[0] : undefined);
            if (exacto) { agregar(exacto); setQ(''); }
        } catch (err) {
            setError((err as Error).message);
        }
    }

    // Totales (el subtotal se redondea una sola vez, igual que en el servidor)
    const subtotal = round2(carrito.reduce((s, l) => s + (Number(l.cantidad) || 0) * l.producto.precio_venta, 0));
    const desc = round2(Number(descuento) || 0);
    const total = round2(subtotal - desc);

    let problema = '';
    if (carrito.length === 0) problema = 'Agrega al menos un producto.';
    for (const l of carrito) {
        const c = Number(l.cantidad);
        const dec = l.producto.permite_decimales;
        if (!(c > 0)) problema = `La cantidad de "${l.producto.nombre}" debe ser mayor que 0.`;
        else if (!cantidadValida(c, dec)) problema = `"${l.producto.nombre}" solo se vende por unidades enteras.`;
        else if (c > l.producto.stock_actual) problema = `Solo hay ${l.producto.stock_actual} de "${l.producto.nombre}".`;
    }
    if (!problema && desc < 0) problema = 'El descuento no puede ser negativo.';
    if (!problema && desc > subtotal) problema = 'El descuento no puede superar el subtotal.';

    async function cobrar(e: FormEvent) {
        e.preventDefault();
        if (problema) return;
        setCobrando(true);
        setError('');
        try {
            const v = await api.vender({
                items: carrito.map((l) => ({ producto_id: l.producto.id, cantidad: Number(l.cantidad) })),
                metodo_pago: metodo,
                descuento: desc > 0 ? desc : undefined,
                notas: notas.trim() || undefined,
            });
            setExito(`Venta #${v.id} registrada por ${money(v.total)}.`);
            setCarrito([]);
            setDescuento('');
            setNotas('');
            setMetodo('efectivo');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setCobrando(false);
            setVersion((x) => x + 1); // refresca el stock mostrado
        }
    }

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Vender</h1>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                {/* Productos */}
                <section className="space-y-3 lg:col-span-3">
                    <input
                        className={input}
                        placeholder="Buscar por nombre o SKU (Enter agrega el producto con ese SKU)"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => void alEnter(e)}
                        autoFocus
                    />
                    <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                        {productos === null && <p className="p-4 text-sm text-muted-foreground">Cargando…</p>}
                        {productos?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No hay productos que coincidan.</p>}
                        {productos?.map((p) => {
                            const agotado = p.stock_actual <= 0;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    disabled={agotado}
                                    onClick={() => agregar(p)}
                                    className={`${card} p-3 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50`}
                                >
                                    <div className="font-medium">{p.nombre}</div>
                                    <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                                    <div className="mt-1 flex items-center justify-between text-sm">
                                        <span className="font-semibold">{money(p.precio_venta)}</span>
                                        <span className={p.stock_bajo ? 'text-destructive' : 'text-muted-foreground'}>
                                            {agotado ? 'Agotado' : `Stock ${p.stock_actual}`}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Carrito */}
                <form onSubmit={cobrar} className={`${card} h-fit space-y-4 p-4 lg:col-span-2`}>
                    <h2 className="font-semibold">Venta actual</h2>

                    {carrito.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Toca un producto para agregarlo.</p>
                    ) : (
                        <ul className="space-y-3">
                            {carrito.map((l) => (
                                <li key={l.producto.id} className="space-y-1 border-b border-border pb-3 last:border-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-sm font-medium">{l.producto.nombre}</span>
                                        <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => quitar(l.producto.id)}>
                                            Quitar
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <input
                                            className={`${input} w-24`}
                                            type="number"
                                            step={stepCantidad(l.producto.permite_decimales)}
                                            min={minCantidad(l.producto.permite_decimales)}
                                            value={l.cantidad}
                                            onChange={(e) => cambiarCantidad(l.producto.id, e.target.value)}
                                            aria-label={`Cantidad de ${l.producto.nombre}`}
                                        />
                                        <span className="text-muted-foreground">× {money(l.producto.precio_venta)}</span>
                                        <span className="ml-auto font-semibold">
                                            {money(round2((Number(l.cantidad) || 0) * l.producto.precio_venta))}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={label}>Método de pago</label>
                            <select className={input} value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                                {METODOS.map((m) => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={label}>Descuento ($)</label>
                            <input className={input} type="number" step="0.01" min="0" value={descuento} onChange={(e) => setDescuento(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={label}>Notas</label>
                        <input className={input} value={notas} maxLength={500} onChange={(e) => setNotas(e.target.value)} />
                    </div>

                    <dl className="space-y-1 text-sm">
                        <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
                        {desc > 0 && <div className="flex justify-between"><dt>Descuento</dt><dd>−{money(desc)}</dd></div>}
                        <div className="flex justify-between text-lg font-semibold"><dt>Total</dt><dd>{money(total)}</dd></div>
                    </dl>

                    {problema && carrito.length > 0 && <p className="text-sm text-destructive">{problema}</p>}
                    {error && <p className={errorBox}>{error}</p>}
                    {exito && <p className="rounded-md border border-border bg-muted p-3 text-sm">{exito}</p>}

                    <div className="flex gap-2">
                        <button className={`${btnPrimary} flex-1`} disabled={cobrando || !!problema}>
                            {cobrando ? 'Cobrando…' : `Cobrar ${money(total)}`}
                        </button>
                        {carrito.length > 0 && (
                            <button type="button" className={btn} onClick={() => { setCarrito([]); setDescuento(''); }}>Vaciar</button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}