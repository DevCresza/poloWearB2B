import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Versão do build: o commit na Vercel, senão a hora do build. Vai embutida no
// JS (import.meta.env.VITE_VERSAO_BUILD) e em /version.json; a aba compara as
// duas para saber que houve deploy novo (src/utils/versaoApp.js).
const VERSAO_BUILD = process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`;

const versaoDoBuild = () => ({
  name: 'polo-versao-build',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ versao: VERSAO_BUILD }),
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versaoDoBuild()],
  define: {
    'import.meta.env.VITE_VERSAO_BUILD': JSON.stringify(VERSAO_BUILD),
  },
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