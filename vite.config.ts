import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Bibliotecas em pedaços próprios: uma atualização da app não obriga a descarregar de novo React/Supabase.
export default defineConfig({
  base: '/familia-salazar/',
  plugins: [react(), {
    // Lista de todos os ficheiros do build para o service worker pré-guardar (inclui separadores carregados a pedido).
    name: 'precache-list',
    generateBundle(_, bundle) { this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(Object.keys(bundle).filter((f) => f.startsWith('assets/'))) }); },
  }],
  build: { target: 'es2020', rollupOptions: { output: { manualChunks: (id) => id.includes('node_modules/@supabase') ? 'supabase' : /node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'react' : undefined } } },
});
