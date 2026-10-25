import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the app from /<repository>/; the deploy workflow sets BASE_PATH accordingly.
  // Local dev and plain builds keep the root path.
  base: process.env.BASE_PATH ?? '/',
})
