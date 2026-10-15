import { useCallback, useEffect, useState } from 'react';
import { RedirectToSignIn, SignedIn, SignedOut, UserButton } from '@neondatabase/auth-ui';
import { api } from '../api';
import type { Me } from '../api';
import Onboarding from './Onboarding';

function Panel() {
    const [me, setMe] = useState<Me | null>(null);
    const [error, setError] = useState('');

    const cargar = useCallback(() => {
        api.me().then(setMe).catch((e: Error) => setError(e.message));
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    return (
        <div className="min-h-screen">
            <header className="flex items-center justify-between border-b px-6 py-3">
                <span className="text-lg font-semibold">{me?.negocio?.nombre ?? 'Inventario y Ventas'}</span>
                <UserButton size="icon" />
            </header>
            <main className="mx-auto max-w-5xl p-6">
                {error && <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
                {me && !me.perfil && <Onboarding onDone={cargar} />}
                {me?.perfil && (
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold">Hola, {me.auth.name ?? me.auth.email}</h1>
                        <p>Tu negocio: <strong>{me.negocio?.nombre}</strong> ({me.negocio?.moneda}, {me.negocio?.zona_horaria})</p>
                        <p className="text-sm opacity-70">Conexión con la API verificada. Rol: {me.perfil.rol}.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function Home() {
    return (
        <>
            <SignedIn><Panel /></SignedIn>
            <SignedOut><RedirectToSignIn /></SignedOut>
        </>
    );
}