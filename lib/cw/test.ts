import { suite, expect } from '@fadroma/tester';
import * as CosmWasm from './index.ts';
export default suite(import.meta, 'CosmWasm',
  expect('Program', expect('Deploy'), expect('Invoke')),
  expect('Project', expect('Init'), expect('Build'), expect('Deploy'),
    expect('SDK', expect('Test'), expect('CLI'), expect('GUI'))));
