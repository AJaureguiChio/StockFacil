import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';

export default function Onboarding({ onDone }: { onDone: () => void }) {
    const [nombre, setNombre] = useState('');
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);

    async function submit(e: FormEvent) {
        e.preventDefault();
        setEnviando(true);
        setError('');
        try {
            await api.onboarding(nombre.trim());
            onDone();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setEnviando(false);
        }
    }

    return (
        <form onSubmit={submit} className="mx-auto mt-16 max-w-md space-y-4 rounded-lg border p-6 shadow-sm">
            <h1 className="text-xl font-semibold">¡Bienvenido! Crea tu negocio</h1>
            <p className="text-sm opacity-70">Con este nombre aparecerá tu tienda en la plataforma.</p>
            <input
                className="w-full rounded border p-2"
                placeholder="Nombre de tu tienda"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                minLength={2}
                maxLength={150}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={enviando} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {enviando ? 'Creando…' : 'Continuar'}
            </button>
        </form>
    );
}