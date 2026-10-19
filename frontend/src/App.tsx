import { Link, Outlet, Route, Routes } from 'react-router';
import Footer from './components/Footer';
import Shell from './components/Shell';
import Account from './pages/Account';
import Auth from './pages/Auth';
import Inicio from './pages/Inicio';
import Productos from './pages/Productos';
import Inventario from './pages/Inventario';
import Vender from './pages/Vender';
import Ventas from './pages/Ventas';

/** Marco de las pantallas fuera del Shell (inicio de sesión y cuenta): marca arriba, contenido y footer. */
function Marco() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <Link to="/" className="text-lg font-bold tracking-tight">Stock Facil</Link>
      </header>
      {/* El contenido ocupa el espacio disponible; se anula min-h-screen de la página hija para que el footer quede visible */}
      <div className="flex flex-1 flex-col [&>*]:min-h-0! [&>*]:flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Marco />}>
        <Route path="/auth/:pathname" element={<Auth />} />
        <Route path="/account/:pathname" element={<Account />} />
      </Route>
      <Route element={<Shell />}>
        <Route index element={<Inicio />} />
        <Route path="productos" element={<Productos />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="vender" element={<Vender />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="*" element={<p>Página no encontrada.</p>} />
      </Route>
    </Routes>
  );
}