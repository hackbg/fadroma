#!/usr/bin/env -S deno run --coverage --allow-run --allow-env --allow-import --allow-read --allow-write=/tmp/fadroma
import * as Watch from '../library/Watch.ts';
export default Watch.entrypoint(import.meta, Watch.runTest, 'test/index.test.ts');
