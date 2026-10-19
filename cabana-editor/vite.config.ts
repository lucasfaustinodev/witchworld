import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  envDir: false,
  server: { host: '0.0.0.0', port: 4173, strictPort: true, fs: { deny: ['**/.env*', '**/.git/**', '**/reference/**'] } },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', sourcemap: true },
})
