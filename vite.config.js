import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'node:os';

// Resolve this machine's LAN IPv4 address so the QR Codes page can build a
// check-in URL that other devices on the network can actually reach —
// http://localhost:5173 only resolves on the machine running the dev server.
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

export default defineConfig({
  plugins: [react()],
  define: {
    __LOCAL_IP__: JSON.stringify(getLocalIp()),
  },
  server: {
    host: true, // Expose server on the local network
    proxy: {
      '/sartopo-api': {
        target: 'https://sartopo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sartopo-api/, ''),
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    server: {
      deps: {
        inline: [/@googlemaps\/js-api-loader/]
      }
    }
  },
  optimizeDeps: {
    include: ['@googlemaps/js-api-loader'],
    esbuildOptions: {}
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) {
              return 'vendor-react';
            }
            if (id.includes('react-router-dom')) {
              return 'vendor-router';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('@googlemaps')) {
              return 'vendor-googlemaps';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
