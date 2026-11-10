import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Load VITE_* values from the repository root .env.
  envDir: '../..',
  server: {
    port: 5173,
  },
});
