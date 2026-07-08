import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  // VITE_API_URL is optional. Leave it unset to use relative /api paths — the Vite dev
  // server proxies those to localhost:3001 below, and vercel.json rewrites them to the
  // production API when deployed. Only set it explicitly for the Docker/App Runner build.
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
