#!/usr/bin/env -S deno run --coverage --allow-run --allow-env --allow-import --allow-read --allow-write=/tmp/fadroma
import { Watch } from './lib/index.ts';
export default Watch.entrypoint(import.meta,
  Watch.runTest, 'lib/index.test.ts');
