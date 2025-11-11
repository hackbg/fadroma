#!/usr/bin/env -S deno run --allow-run --allow-env --allow-import --allow-read --allow-write=/tmp/fadroma
import { Watch } from './lib/index.ts';
export default Watch.entrypoint(import.meta,
  Watch.denoCheck, 'lib/index.test.ts', 'index.ts');
