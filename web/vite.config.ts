import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/signup',
  // VITE_API_URL must be set at build time for production.
  // Dev server proxies /api to localhost:3001 so VITE_API_URL can be left unset locally.
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
