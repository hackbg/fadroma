#!/usr/bin/env -S deno run --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=localhost
import { Test, pipe, tmp, fsContext, spawnContext } from '@hackbg/fadroma';
import { simfInit, simfBuild } from './index.ts';
import { resolvePath, fileURLToPath } from './deps.ts';
const { the } = Test;
export default Test.suite(import.meta, 'Simplicity',
  the('Deploy'),
  the('Invoke'),
  the('Init', async () => {
    const [[result]] = await tmp('test-simf', simfInit({ name: 'test' }))(fsContext());
    Test.equal(result.length, 221);
  }),
  the('Build', async (_, { log }) => {
    const cwd     = resolvePath(fileURLToPath(import.meta.url), '..');
    const context = pipe(spawnContext, fsContext)({ cwd });
    const result  = await simfBuild({ name: 'example' })(context);
    log(result);
    //equal(result.length, 221);
  }),
  the('Deploy'),
  the('Test'),
  the('SDK', the('Test'), the('CLI'), the('GUI')));
