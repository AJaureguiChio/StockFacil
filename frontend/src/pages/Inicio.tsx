import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import type { Alerta, Resumen, TopProducto, VentasPeriodo } from '../api';
import { diaCorto, inicioDiaEn, ultimosDias } from '../fechas';
import { useMe } from '../me-context';
import { fmtFecha } from '../movimientos';
import { round3 } from '../num';
import { btn, card, errorBox } from '../ui';

type Periodo = 'hoy' | '7' | '30';
const PERIODOS: { id: Periodo; label: string; dias: number }[] = [
    { id: 'hoy', label: 'Hoy', dias: 1 },
    { id: '7', label: '7 días', dias: 7 },
    { id: '30', label: '30 días', dias: 30 },
];

function Tarjeta({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
    return (
        <div className={`${card} p-4`}>
            <p className="text-xs text-muted-foreground">{titulo}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
            {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
        </div>
    );
}

export default function Inicio() {
    const { me, money } = useMe();
    const zona = me.negocio?.zona_horaria ?? 'UTC';

    const [periodo, setPeriodo] = useState<Periodo>('7');
    const [version, setVersion] = useState(0);
    const [resumen, setResumen] = useState<Resumen | null>(null);
    const [serie, setSerie] = useState<VentasPeriodo[]>([]);
    const [top, setTop] = useState<TopProducto[]>([]);
    const [alertas, setAlertas] = useState<Alerta[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const dias = PERIODOS.find((p) => p.id === periodo)!.dias;

    useEffect(() => {
        let vigente = true;
        setCargando(true);
        setError('');
        const lista = ultimosDias(dias, zona);
        const rango = { desde: inicioDiaEn(lista[0], zona).toISOString(), hasta: new Date().toISOString() };
        Promise.all([
            api.resumen(rango),
            api.reporteVentas({ ...rango, agrupar: 'dia' }),
            api.productosTop({ ...rango, limit: 5 }),
            api.alertas(),
        ])
            .then(([r, s, t, a]) => {
                if (!vigente) return;
                setResumen(r);
                setSerie(s);
                setTop(t);
                setAlertas(a);
            })
            .catch((e: Error) => { if (vigente) setError(e.message); })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [dias, zona, version]);

    async function marcar(id: number) {
        try {
            await api.leerAlerta(id);
            setAlertas((prev) => prev.filter((a) => a.id !== id));
        } catch (e) {
            setError((e as Error).message);
        }
    }
    async function marcarTodas() {
        try {
            await api.leerTodasAlertas();
            setAlertas([]);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    // Serie completa: días sin ventas cuentan como 0
    const porDia = new Map(serie.map((s) => [String(s.periodo).slice(0, 10), Number(s.total_vendido)]));
    const barras = ultimosDias(dias, zona).map((dia) => ({ dia, total: porDia.get(dia) ?? 0 }));
    const maximo = Math.max(...barras.map((b) => b.total), 0);
    const paso = Math.ceil(barras.length / 7);

    const inv = resumen?.inventario;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">Hola, {me.auth.name ?? me.auth.email ?? 'bienvenido'}</h1>
                    <p className="text-sm text-muted-foreground">
                        {me.negocio?.nombre} · {me.perfil?.rol}
                    </p>
                </div>
                <div className="flex gap-1" role="group" aria-label="Periodo">
                    {PERIODOS.map((p) => (
                        <button
                            key={p.id}
                            className={`${btn} ${periodo === p.id ? 'bg-muted font-medium' : ''}`}
                            aria-pressed={periodo === p.id}
                            onClick={() => setPeriodo(p.id)}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button className={btn} onClick={() => setVersion((v) => v + 1)} disabled={cargando} title="Actualizar">↻</button>
                </div>
            </div>

            {error && <p className={errorBox}>{error}</p>}
            {cargando && !resumen && <p className="text-sm text-muted-foreground">Cargando…</p>}

            {resumen && (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <Tarjeta titulo="Ventas" valor={String(resumen.num_ventas)} />
                        <Tarjeta titulo="Total vendido" valor={money(resumen.total_vendido)} />
                        <Tarjeta titulo="Ticket promedio" valor={money(resumen.ticket_promedio)} />
                        <Tarjeta titulo="Utilidad" valor={money(resumen.utilidad)} nota="Después de descuentos" />
                    </div>

                    {dias > 1 && (
                        <section className={`${card} p-4`}>
                            <h2 className="mb-3 text-sm font-medium">Ventas por día</h2>
                            {maximo === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">Sin ventas en este periodo.</p>
                            ) : (
                                <>
                                    <div className="flex h-40 items-end gap-1">
                                        {barras.map((b) => (
                                            <div
                                                key={b.dia}
                                                className="flex-1 rounded-t bg-primary/80"
                                                style={{ height: `${b.total > 0 ? Math.max((b.total / maximo) * 100, 3) : 0}%` }}
                                                title={`${diaCorto(b.dia)}: ${money(b.total)}`}
                                            />
                                        ))}
                                    </div>
                                    <div className="mt-1 flex gap-1">
                                        {barras.map((b, i) => (
                                            <span key={b.dia} className="flex-1 text-center text-[10px] text-muted-foreground">
                                                {i % paso === 0 ? diaCorto(b.dia) : ''}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </section>
                    )}

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <section className={`${card} p-4`}>
                            <h2 className="mb-3 text-sm font-medium">Más vendidos</h2>
                            {top.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin ventas en este periodo.</p>
                            ) : (
                                <ol className="divide-y divide-border text-sm">
                                    {top.map((t, i) => (
                                        <li key={t.producto_id} className="flex items-center gap-3 py-2">
                                            <span className="w-5 text-muted-foreground">{i + 1}</span>
                                            <span className="flex-1 truncate">{t.nombre}</span>
                                            <span className="text-muted-foreground">{round3(t.unidades)} u.</span>
                                            <span className="w-24 text-right font-medium tabular-nums">{money(t.ingresos)}</span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </section>

                        <section className={`${card} p-4`}>
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-sm font-medium">
                                    Alertas de stock bajo {alertas.length > 0 && <span className="ml-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{alertas.length}</span>}
                                </h2>
                                {alertas.length > 1 && <button className={btn} onClick={marcarTodas}>Marcar todas</button>}
                            </div>
                            {alertas.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Todo en orden: no hay alertas pendientes.</p>
                            ) : (
                                <ul className="divide-y divide-border text-sm">
                                    {alertas.map((a) => (
                                        <li key={a.id} className="flex items-start gap-3 py-2">
                                            <div className="flex-1">
                                                <p className="font-medium">{a.producto}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Quedan {a.stock_actual} (mínimo {a.stock_minimo}) · {fmtFecha(a.creada_en, zona)}
                                                </p>
                                            </div>
                                            <Link className={btn} to={`/inventario?producto=${a.producto_id}`}>Reponer</Link>
                                            <button className={btn} onClick={() => marcar(a.id)}>Leída</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    {inv && (
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <Tarjeta titulo="Productos activos" valor={String(inv.productos_activos)} />
                            <Tarjeta titulo="Con stock bajo" valor={String(inv.productos_stock_bajo)} nota={inv.productos_stock_bajo > 0 ? 'Revisa las alertas' : undefined} />
                            <Tarjeta titulo="Inventario a costo" valor={money(inv.valor_costo)} />
                            <Tarjeta titulo="Inventario a precio de venta" valor={money(inv.valor_venta)} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}