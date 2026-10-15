import { Route, Routes } from 'react-router';
import Account from './pages/Account';
import Auth from './pages/Auth';
import Home from './pages/Home';

export default function App() {
  return (
    <Routes>
      <Route path="/auth/:pathname" element={<Auth />} />
      <Route path="/account/:pathname" element={<Account />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}