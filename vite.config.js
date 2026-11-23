import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas que todo acesso usa e que mudam pouco ficam em arquivos
        // proprios: um deploy que so mexe em telas nao invalida o cache delas.
        // As pesadas e raras (recharts, jspdf, html2canvas) NAO entram aqui: ja
        // vao para chunks separados sozinhas, porque so sao importadas por
        // paginas lazy ou por import() dinamico. Forcar um chunk para o recharts
        // puxava dependencias compartilhadas para ele e o fazia carregar na home.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return 'vendor-react';
          if (/node_modules[\\/]@supabase[\\/]/.test(id)) return 'vendor-supabase';
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
}) 