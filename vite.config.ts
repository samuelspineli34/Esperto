import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: true, // Garante que o WSL consiga se comunicar perfeitamente
    watch: {
      usePolling: true, // Garante que o hot-reload funcione no WSL
    },
  },
});