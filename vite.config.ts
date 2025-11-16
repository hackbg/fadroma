import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const include: Parameters<typeof nodePolyfills>[0]["include"] =
  [ 'assert', 'timers', 'os', 'url', 'path', 'util', 'buffer', 'crypto', 'http', 'process', 'stream' ];
const alias = [
  { find: 'node:fs/promises',   replacement: resolve(__dirname, 'lib/stub/stub_fs.ts') },
  { find: 'node:fs',            replacement: resolve(__dirname, 'lib/stub/stub_fs.ts') },
  { find: 'node:child_process', replacement: resolve(__dirname, 'lib/stub/stub_child_process.ts') },
  { find: 'node:net',           replacement: resolve(__dirname, 'lib/stub/stub_net.ts') },
  //{ find: 'node:process',       replacement: resolve(__dirname, 'lib/stub/stub_process.ts') },
];
export default defineConfig({
  publicDir: 'var',
  resolve: { alias },
  plugins: [
    { configureServer (s) { s.middleware.use('/docs', (req, res, next) => { throw new Error() }) } },
    nodePolyfills({ include }),
  ],
});
