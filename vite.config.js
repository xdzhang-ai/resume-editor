import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      // 开发时把 /api 转发到 Node 后端（默认 3001）
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
