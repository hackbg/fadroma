#!/usr/bin/env -S deno run --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=localhost
import { testSuite, expect, call } from '@hackbg/fadroma';
import {
  simfInit,
  simfBuild,
} from './index.ts';

export const name = 'SimplicityHL';

export const testSimfInit = expect('Init', async () => {
});

export default testSuite(import.meta, 'Simplicity',
  expect('Deploy'), expect('Invoke'),
  testSimfInit,
  expect('Build'), expect('Deploy'), expect('Test'),
  expect('SDK', expect('Test'), expect('CLI'), expect('GUI')));
