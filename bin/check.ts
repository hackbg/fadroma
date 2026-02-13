#!/usr/bin/env -S deno run --allow-run --allow-env --allow-import --allow-read --allow-write=/tmp/fadroma
import { entrypoint, denoCheck } from '../library/Watch.ts';
export default entrypoint(import.meta, denoCheck, 'lib/index.test.ts', 'index.ts');
