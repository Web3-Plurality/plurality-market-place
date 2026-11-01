import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig(({ mode }) => {
  // Fail the build on a mistyped chain rather than shipping a UI that signs
  // on the wrong network. Unset means testnet (local dev).
  const chain = loadEnv(mode, process.cwd(), 'VITE_APP_').VITE_APP_CHAIN || 'testnet'
  if (chain !== 'testnet' && chain !== 'mainnet') {
    throw new Error(`VITE_APP_CHAIN must be 'testnet' or 'mainnet', got '${chain}'`)
  }

  return {
    plugins: [
      react({
        babel: {
          plugins: [
            ['babel-plugin-styled-components', { displayName: true }]
          ]
        }
      }),
      nodePolyfills({
        include: ['buffer', 'process', 'crypto', 'stream', 'util']
      }),
    ],
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      port: 3001,
      open: true,
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Keep the heavy, rarely-changing vendors out of the app chunk so a
          // UI tweak doesn't invalidate the whole download.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/node_modules/ai/') || id.includes('/@ai-sdk/') || id.includes('/zod/')) return 'ai-sdk';
            if (id.includes('/@metamask/')) return 'metamask';
            if (id.includes('/antd/') || id.includes('/@ant-design/') || id.includes('/rc-')) return 'antd';
            return undefined;
          },
        },
      },
    },
  }
})
