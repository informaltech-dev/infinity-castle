import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true, port: 5190, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 3000 },
});
