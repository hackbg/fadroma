#!/usr/bin/env -S deno run --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=localhost
import { equal, tmp, testSuite, expect, call, fsContext, spawnContext } from '@hackbg/fadroma';
import { simfInit, simfBuild } from './index.ts';
import { resolvePath, fileURLToPath } from './deps.ts';

export const name = 'SimplicityHL';

export const testSimfInit = expect('Init', async () => {
  const [[result]] = await tmp('test-simf', simfInit({ name: 'test' }))(fsContext());
  equal(result.length, 221);
});

export const testSimfBuild = expect('Build', async () => {
  const result = await simfBuild({ name: 'example' })(spawnContext(fsContext({
    cwd: resolvePath(fileURLToPath(import.meta.url), '..')
  })));
  console.log(result);
  //equal(result.length, 221);
});

export default testSuite(import.meta, 'Simplicity',
  expect('Deploy'), expect('Invoke'),
  testSimfInit, testSimfBuild,
  expect('Deploy'), expect('Test'),
  expect('SDK', expect('Test'), expect('CLI'), expect('GUI')));
