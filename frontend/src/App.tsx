import { Route, Routes } from 'react-router';
import Shell from './components/Shell';
import Account from './pages/Account';
import Auth from './pages/Auth';
import Inicio from './pages/Inicio';
import Productos from './pages/Productos';

export default function App() {
  return (
    <Routes>
      <Route path="/auth/:pathname" element={<Auth />} />
      <Route path="/account/:pathname" element={<Account />} />
      <Route element={<Shell />}>
        <Route index element={<Inicio />} />
        <Route path="productos" element={<Productos />} />
        <Route path="*" element={<p>Página no encontrada.</p>} />
      </Route>
    </Routes>
  );
}