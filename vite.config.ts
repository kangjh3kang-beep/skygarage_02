import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'node:fs'

const appRelease = process.env.CF_PAGES_COMMIT_SHA || process.env.COMMIT_REF || `local-${Date.now()}`;

export default defineConfig({
  define: { 'import.meta.env.VITE_APP_RELEASE': JSON.stringify(appRelease) },
  plugins: [react(), {
    name: 'app-release',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'app-version.json', source: JSON.stringify({ release: appRelease }) });
    },
  }, {
    // Existing open tabs can still request the pre-renewal image URLs.
    // Serve the current photography at those URLs as well as the hashed imports.
    name: 'resident-brand-compatibility',
    generateBundle() {
      const photos = ['home', 'call', 'garage', 'access', 'profile', 'requests', 'wallet'];
      for (const photo of photos) {
        for (const [name, source] of [['800', '800'], ['1672', 'full']]) {
          this.emitFile({ type: 'asset', fileName: `doelv/imagery-v2/${photo}-${name}.webp`,
            source: readFileSync(path.resolve(__dirname, `src/sgp/assets/photography/${photo}-${source}.webp`)) });
        }
      }
      for (const [legacy, photo] of [['residence', 'home'], ['garage', 'garage'], ['lobby', 'access'], ['arrival', 'profile']]) {
        this.emitFile({ type: 'asset', fileName: `doelv/${legacy}.webp`,
          source: readFileSync(path.resolve(__dirname, `src/sgp/assets/photography/${photo}-full.webp`)) });
      }
    },
  }],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
