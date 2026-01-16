import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteCommonjs()],
  optimizeDeps: {
    exclude: ['@cornerstonejs/dicom-image-loader'],
    include: ['dicom-parser']
  },
  worker: {
    format: 'es',
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces for mobile app access
    port: 5173,
  },
  build: {
    // Ensure public files are included in build
    copyPublicDir: true,
  }
})
