#!/usr/bin/env -S deno run --allow-env
import { suite, expect } from '@fadroma/tester';
import * as Spawn from './index.ts';
export default suite(import.meta, 'Spawn',
  expect('Process'),
  expect('Docker', 'Pull', 'Run', 'Kill', 'Build'))
