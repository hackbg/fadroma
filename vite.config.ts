import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const relpath = (...args: string[]) => resolve(__dirname, ...args);
const include: Parameters<typeof nodePolyfills>[0]["include"] =
  [ 'assert', 'timers', 'os', 'url', 'path', 'util', 'buffer', 'http', 'process', 'stream' ];
const alias = [
  { find: 'env',                replacement: relpath('wasm_env.ts')                    },
  { find: 'node:fs/promises',   replacement: relpath('gui/stub/stub_fs.ts')            },
  { find: 'node:fs',            replacement: relpath('gui/stub/stub_fs.ts')            },
  { find: 'node:child_process', replacement: relpath('gui/stub/stub_child_process.ts') },
  { find: 'node:net',           replacement: relpath('gui/stub/stub_net.ts')           },
  { find: 'npm:log-update',     replacement: relpath('gui/stub/stub_log.ts')           },
  //{ find: 'node:process',       replacement: resolve(__dirname, 'stub/stub_process.ts') },
];
export default defineConfig({
  root:      'gui',
  publicDir: '../www',
  build:     { outDir: '../.misc/gh-pages' },
  resolve:   { alias },
  plugins:   [ nodePolyfills({ include }), ],
  server:    { allowedHosts: ["vite.dev.hack.bg"] }
});
