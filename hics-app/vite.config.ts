import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Use root deployment by default; override for subpath hosting (e.g. GitHub Pages).
  base: process.env.VITE_BASE_PATH || '/',
})
