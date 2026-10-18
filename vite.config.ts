import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const appRelease = process.env.CF_PAGES_COMMIT_SHA || process.env.COMMIT_REF || `local-${Date.now()}`;

export default defineConfig({
  define: { 'import.meta.env.VITE_APP_RELEASE': JSON.stringify(appRelease) },
  plugins: [react(), {
    name: 'app-release',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'app-version.json', source: JSON.stringify({ release: appRelease }) });
    },
  }],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
