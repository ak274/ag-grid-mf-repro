import react from '@vitejs/plugin-react'
import { federation } from '@module-federation/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'host',
      remotes: {
        remote: 'http://localhost:4173/mf-manifest.json',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        'ag-grid-community': {
          singleton: true,
          requiredVersion: '^36.1.0',
        },
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
})
