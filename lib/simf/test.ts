import * as _ from './index.ts';
import { suite, expect } from '../../lib/tester/index.ts';
export const name = 'Simplicity';
export default suite(import.meta, 'Simplicity',
  expect('Program',  expect('Deploy'),  expect('Invoke')),
  expect('Project', expect('Init'), expect('Build'), expect('Deploy'),
    expect('SDK', expect('Test'), expect('CLI'), expect('GUI'))));
