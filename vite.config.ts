import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
export default defineConfig({
  publicDir: 'var',
  plugins: [
    nodePolyfills({
      include: ['process'],
      globals: { global: true, process: true },
    }),
  ],
});
