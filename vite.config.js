import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        secure: false
      }
    }
  },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/scratch/**']
  }
})
