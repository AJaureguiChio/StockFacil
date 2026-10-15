import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { RedirectToSignIn, SignedIn, SignedOut, UserButton } from '@neondatabase/auth-ui';
import { api } from '../api';
import type { Me } from '../api';
import { MeContext } from '../me-context';
import type { MeCtx } from '../me-context';
import Onboarding from '../pages/Onboarding';
import { btn, errorBox } from '../ui';

const NAV = [
    { to: '/', label: 'Inicio', end: true },
    { to: '/vender', label: 'Vender', end: false },
    { to: '/ventas', label: 'Ventas', end: false },
    { to: '/productos', label: 'Productos', end: false },
    { to: '/inventario', label: 'Inventario', end: false },
];
function Gate() {
    const [me, setMe] = useState<Me | null>(null);
    const [error, setError] = useState('');

    const cargar = useCallback(() => {
        api.me().then((m) => { setMe(m); setError(''); }).catch((e: Error) => setError(e.message));
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const ctx = useMemo<MeCtx | null>(() => {
        if (!me?.negocio) return null;
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: me.negocio.moneda });
        return { me, money: (n) => fmt.format(n) };
    }, [me]);

    if (error) {
        return (
            <div className="mx-auto mt-16 max-w-md space-y-3 p-6">
                <p className={errorBox}>{error}</p>
                <button className={btn} onClick={cargar}>Reintentar</button>
            </div>
        );
    }
    if (!me) return <p className="p-6 text-muted-foreground">Cargando…</p>;
    if (!me.perfil || !ctx) return <Onboarding onDone={cargar} />;

    return (
        <MeContext.Provider value={ctx}>
            <div className="min-h-screen bg-background text-foreground">
                <header className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-lg font-semibold">{me.negocio?.nombre}</span>
                    <UserButton size="icon" />
                </header>
                <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row md:gap-8">
                    <nav className="flex gap-1 overflow-x-auto md:w-44 md:shrink-0 md:flex-col">
                        {NAV.map((n) => (
                            <NavLink
                                key={n.to}
                                to={n.to}
                                end={n.end}
                                className={({ isActive }) =>
                                    `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
                                }
                            >
                                {n.label}
                            </NavLink>
                        ))}
                    </nav>
                    <main className="min-w-0 flex-1"><Outlet /></main>
                </div>
            </div>
        </MeContext.Provider>
    );
}

export default function Shell() {
    return (
        <>
            <SignedIn><Gate /></SignedIn>
            <SignedOut><RedirectToSignIn /></SignedOut>
        </>
    );
}