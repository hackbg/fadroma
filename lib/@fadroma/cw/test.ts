#!/usr/bin/env -S deno run --allow-env
import { suite, expect } from '@hackbg/fadroma';
import * as CosmWasm from './index.ts';
export default suite(import.meta, 'CosmWasm',
  expect('Program', expect('Upload'), expect('Instantiate'), expect('Method')),
  expect('Project', expect('Init'), expect('Build'), expect('Deploy'),
    expect('SDK', expect('Test'), expect('CLI'), expect('GUI'))));
