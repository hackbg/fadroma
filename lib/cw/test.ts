import { suite, expect } from '@fadroma/tester';
import * as CosmWasm from './index.ts';
export default suite(import.meta, 'CosmWasm',
  expect('Program', expect('Upload'), expect('Instantiate'), expect('Method')),
  expect('Project', expect('Init'), expect('Build'), expect('Deploy'),
    expect('SDK', expect('Test'), expect('CLI'), expect('GUI'))));
