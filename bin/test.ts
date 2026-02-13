#!/usr/bin/env -S deno run --coverage --allow-run --allow-env --allow-import --allow-read --allow-write=/tmp/fadroma
import { entrypoint, runTest } from '../library/Watch.ts';
export default entrypoint(import.meta, runTest, 'test/index.test.ts');
