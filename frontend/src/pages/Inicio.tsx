import { useMe } from '../me-context';

export default function Inicio() {
    const { me } = useMe();
    return (
        <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Hola, {me.auth.name ?? me.auth.email}</h1>
            <p>
                Tu negocio: <strong>{me.negocio?.nombre}</strong> ({me.negocio?.moneda}, {me.negocio?.zona_horaria})
            </p>
            <p className="text-sm text-muted-foreground">Rol: {me.perfil?.rol}. Aquí irá el resumen del día.</p>
        </div>
    );
}