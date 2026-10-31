import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env from both client and root directories
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const clientEnv = loadEnv(mode, __dirname, '');
  const backendPort = clientEnv.VITE_BACKEND_PORT || rootEnv.PORT || '5001';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
