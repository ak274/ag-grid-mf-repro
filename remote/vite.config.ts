import react from '@vitejs/plugin-react'
import { federation } from '@module-federation/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'remote',
      filename: 'remoteEntry.js',
      manifest: true,
      dts: false,
      shareStrategy: 'loaded-first',
      exposes: {
        './App': './src/App.tsx',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        'ag-grid-community': {
          singleton: true,
          import: false,
          requiredVersion: '^36.1.0',
        },
      },
    }),
  ],
  server: {
    port: 4173,
    strictPort: true,
  },
})
