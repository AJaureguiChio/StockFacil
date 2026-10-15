import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: '..', // lee el .env de la raíz del monorepo (Vite solo expone las variables VITE_*)
  server: { port: 5173 },
});