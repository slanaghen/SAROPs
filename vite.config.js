import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sartopo-api': {
        target: 'https://sartopo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sartopo-api/, ''),
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
