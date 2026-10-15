import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Categoria, Producto, Proveedor } from '../api';
import ProductoForm from '../components/ProductoForm';
import { useMe } from '../me-context';
import { btn, btnPrimary, card, errorBox, input } from '../ui';

type Estado = 'activos' | 'todos' | 'desactivados';
type Editor = null | { producto?: Producto };

export default function Productos() {
    const { money } = useMe();
    const [productos, setProductos] = useState<Producto[] | null>(null);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [q, setQ] = useState('');
    const [busqueda, setBusqueda] = useState(''); // q con retraso, para no consultar en cada tecla
    const [estado, setEstado] = useState<Estado>('activos');
    const [soloBajo, setSoloBajo] = useState(false);
    const [version, setVersion] = useState(0); // al cambiar, se vuelve a cargar la lista
    const [editor, setEditor] = useState<Editor>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setBusqueda(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        Promise.all([api.categorias(), api.proveedores()])
            .then(([c, p]) => { setCategorias(c); setProveedores(p); })
            .catch((e: Error) => setError(e.message));
    }, []);

    useEffect(() => {
        let vigente = true;
        api
            .productos({
                q: busqueda || undefined,
                activo: estado === 'todos' ? undefined : estado === 'activos',
                stock_bajo: soloBajo || undefined,
            })
            .then((d) => { if (vigente) { setProductos(d); setError(''); } })
            .catch((e: Error) => { if (vigente) setError(e.message); });
        return () => { vigente = false; };
    }, [busqueda, estado, soloBajo, version]);

    const recargar = () => setVersion((v) => v + 1);

    async function accion(fn: () => Promise<unknown>) {
        try { await fn(); recargar(); } catch (e) { setError((e as Error).message); }
    }

    function desactivar(p: Producto) {
        if (!confirm(`¿Desactivar "${p.nombre}"?\nDejará de poder venderse; su historial se conserva y puedes reactivarlo.`)) return;
        void accion(() => api.desactivarProducto(p.id));
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-semibold">Productos</h1>
                <button className={btnPrimary} onClick={() => setEditor({})}>+ Nuevo producto</button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <input className={`${input} max-w-xs`} placeholder="Buscar por nombre o SKU" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className={`${input} w-auto`} value={estado} onChange={(e) => setEstado(e.target.value as Estado)}>
                    <option value="activos">Activos</option>
                    <option value="desactivados">Desactivados</option>
                    <option value="todos">Todos</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={soloBajo} onChange={(e) => setSoloBajo(e.target.checked)} />
                    Solo stock bajo
                </label>
            </div>

            {error && <p className={errorBox}>{error}</p>}

            <div className={`${card} overflow-x-auto`}>
                <table className="w-full text-sm">
                    <thead className="bg-muted text-left">
                        <tr>
                            <th className="p-3">SKU</th>
                            <th className="p-3">Producto</th>
                            <th className="p-3 text-right">Precio</th>
                            <th className="p-3 text-right">Stock</th>
                            <th className="p-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos === null && (
                            <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>
                        )}
                        {productos?.length === 0 && (
                            <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No hay productos con estos filtros.</td></tr>
                        )}
                        {productos?.map((p) => (
                            <tr key={p.id} className={`border-t border-border ${p.activo ? '' : 'opacity-60'}`}>
                                <td className="p-3 font-mono">{p.sku}</td>
                                <td className="p-3">
                                    <div className="font-medium">
                                        {p.nombre}
                                        {!p.activo && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">Desactivado</span>}
                                    </div>
                                    {p.categoria && <div className="text-xs text-muted-foreground">{p.categoria}</div>}
                                </td>
                                <td className="p-3 text-right">{money(p.precio_venta)}</td>
                                <td className={`p-3 text-right font-semibold ${p.stock_bajo && p.activo ? 'text-destructive' : ''}`}>
                                    {p.stock_actual}
                                    {p.stock_bajo && p.activo && <div className="text-xs font-normal">Stock bajo (mín. {p.stock_minimo})</div>}
                                </td>
                                <td className="space-x-2 p-3 text-right whitespace-nowrap">
                                    <button className={btn} onClick={() => setEditor({ producto: p })}>Editar</button>
                                    {p.activo ? (
                                        <button className={btn} onClick={() => desactivar(p)}>Desactivar</button>
                                    ) : (
                                        <button className={btn} onClick={() => void accion(() => api.editarProducto(p.id, { activo: true }))}>Reactivar</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editor && (
                <ProductoForm
                    key={editor.producto?.id ?? 'nuevo'}
                    producto={editor.producto}
                    categorias={categorias}
                    proveedores={proveedores}
                    onCategoriaCreada={(c) => setCategorias((prev) => [...prev, c].sort((a, b) => a.nombre.localeCompare(b.nombre)))}
                    onClose={() => setEditor(null)}
                    onSaved={() => { setEditor(null); recargar(); }}
                />
            )}
        </div>
    );
}