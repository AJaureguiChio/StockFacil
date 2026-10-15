import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { Categoria, Producto, Proveedor } from '../api';
import { btn, btnPrimary, card, errorBox, input, label } from '../ui';

interface Props {
    /** Si viene un producto, el formulario edita; si no, crea. */
    producto?: Producto;
    categorias: Categoria[];
    proveedores: Proveedor[];
    onCategoriaCreada: (c: Categoria) => void;
    onClose: () => void;
    onSaved: () => void;
}

/** Texto del campo -> número (o undefined si está vacío). */
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

export default function ProductoForm({ producto, categorias, proveedores, onCategoriaCreada, onClose, onSaved }: Props) {
    const editando = !!producto;
    const [sku, setSku] = useState(producto?.sku ?? '');
    const [nombre, setNombre] = useState(producto?.nombre ?? '');
    const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
    const [categoriaId, setCategoriaId] = useState(producto?.categoria_id?.toString() ?? '');
    const [proveedorId, setProveedorId] = useState(producto?.proveedor_id?.toString() ?? '');
    const [costo, setCosto] = useState(producto?.precio_costo?.toString() ?? '');
    const [precio, setPrecio] = useState(producto?.precio_venta?.toString() ?? '');
    const [minimo, setMinimo] = useState(producto?.stock_minimo?.toString() ?? '');
    const [inicial, setInicial] = useState('');
    const [permiteDecimales, setPermiteDecimales] = useState(producto?.permite_decimales ?? false);
    const [nuevaCat, setNuevaCat] = useState<string | null>(null); // null = oculto
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);

    async function crearCategoria() {
        const nombreCat = (nuevaCat ?? '').trim();
        if (!nombreCat) return;
        try {
            const c = await api.crearCategoria(nombreCat);
            onCategoriaCreada(c);
            setCategoriaId(String(c.id));
            setNuevaCat(null);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    async function submit(e: FormEvent) {
        e.preventDefault();
        setGuardando(true);
        setError('');

        if (!permiteDecimales) {
            const fraccion = (v: string) => v.trim() !== '' && !Number.isInteger(Number(v));
            if (fraccion(minimo) || fraccion(inicial)) {
                setError('Sin decimales, el stock mínimo y el inicial deben ser números enteros.');
                setGuardando(false);
                return;
            }
            if (producto && !Number.isInteger(producto.stock_actual)) {
                setError(`El stock actual (${producto.stock_actual}) tiene decimales: no puedes desactivar los decimales.`);
                setGuardando(false);
                return;
            }
        }

        try {
            if (producto) {
                await api.editarProducto(producto.id, {
                    sku: sku.trim(),
                    nombre: nombre.trim(),
                    descripcion,
                    categoria_id: categoriaId ? Number(categoriaId) : null,
                    proveedor_id: proveedorId ? Number(proveedorId) : null,
                    precio_costo: num(costo) ?? 0,
                    precio_venta: Number(precio),
                    stock_minimo: num(minimo) ?? 0,
                    permite_decimales: permiteDecimales,
                });
            } else {
                await api.crearProducto({
                    sku: sku.trim(),
                    nombre: nombre.trim(),
                    descripcion: descripcion.trim() || undefined,
                    categoria_id: categoriaId ? Number(categoriaId) : undefined,
                    proveedor_id: proveedorId ? Number(proveedorId) : undefined,
                    precio_costo: num(costo),
                    precio_venta: Number(precio),
                    stock_minimo: num(minimo),
                    stock_inicial: num(inicial),
                    permite_decimales: permiteDecimales,
                });
            }
            onSaved();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className={`${card} max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6 shadow-lg`}
            >
                <h2 className="text-lg font-semibold">{editando ? 'Editar producto' : 'Nuevo producto'}</h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className={label}>SKU *</label>
                        <input className={input} value={sku} onChange={(e) => setSku(e.target.value)} required maxLength={60} />
                    </div>
                    <div className="sm:col-span-2">
                        <label className={label}>Nombre *</label>
                        <input className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={200} />
                    </div>
                </div>

                <div>
                    <label className={label}>Descripción</label>
                    <textarea className={input} rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className={label}>Categoría</label>
                        <div className="flex gap-2">
                            <select className={input} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                                <option value="">Sin categoría</option>
                                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                            <button type="button" className={btn} title="Nueva categoría" onClick={() => setNuevaCat(nuevaCat === null ? '' : null)}>+</button>
                        </div>
                        {nuevaCat !== null && (
                            <div className="mt-2 flex gap-2">
                                <input className={input} placeholder="Nombre de la categoría" value={nuevaCat} maxLength={100}
                                    onChange={(e) => setNuevaCat(e.target.value)} />
                                <button type="button" className={btn} onClick={crearCategoria}>Crear</button>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className={label}>Proveedor</label>
                        <select className={input} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                            <option value="">Sin proveedor</option>
                            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                    </div>
                </div>

                <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={permiteDecimales}
                        onChange={(e) => setPermiteDecimales(e.target.checked)} />
                    <span>
                        Se vende por peso o volumen (permite decimales)
                        <span className="block text-xs text-muted-foreground">
                            Márcalo para productos como queso, tela o aceite. Si no, solo se venderán unidades enteras.
                        </span>
                    </span>
                </label>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                        <label className={label}>Costo</label>
                        <input className={input} type="number" step="0.01" min="0" value={costo} onChange={(e) => setCosto(e.target.value)} />
                    </div>
                    <div>
                        <label className={label}>Precio venta *</label>
                        <input className={input} type="number" step="0.01" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} required />
                    </div>
                    <div>
                        <label className={label}>Stock mínimo</label>
                        <input className={input} type="number" step={permiteDecimales ? '0.001' : '1'} min="0" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
                    </div>
                    {!editando && (
                        <div>
                            <label className={label}>Stock inicial</label>
                            <input className={input} type="number" step={permiteDecimales ? '0.001' : '1'} min="0" value={inicial} onChange={(e) => setInicial(e.target.value)} />
                        </div>
                    )}
                </div>

                {editando && (
                    <p className="text-xs text-muted-foreground">
                        Stock actual: {producto.stock_actual}. No se edita aquí: cambia con entradas, salidas y ventas.
                    </p>
                )}
                {error && <p className={errorBox}>{error}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" className={btn} onClick={onClose}>Cancelar</button>
                    <button className={btnPrimary} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
                </div>
            </form>
        </div>
    );
}