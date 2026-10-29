import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: web chạy :5173, proxy /api và /uploads sang backend :4000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
