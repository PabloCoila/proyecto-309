import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Odoo no emite cabeceras CORS: el navegador habla con Vite y Vite con Odoo.
    proxy: {
      '/odoo': {
        // 127.0.0.1 evita que Node resuelva "localhost" a ::1 (Docker publica IPv4).
        target: 'http://127.0.0.1:8069',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/odoo/, ''),
      },
    },
  },
});
