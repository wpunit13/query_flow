import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: true,
    },
  },
  resolve: {
    // This forces Vite to use only ONE instance of React, preventing the Hook error
    dedupe: ['react', 'react-dom', '@xyflow/react'],
  },
  optimizeDeps: {
    // This forces Vite to pre-bundle the flow library correctly
    include: ['@xyflow/react']
  }
})