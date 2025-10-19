import * as _ from './index.ts';
import { suite, expect } from '../../lib/tester/index.ts';
export const name = 'Simplicity';
export default suite(import.meta, 'Simplicity',
  expect('Deploy'), expect('Invoke'),
  expect('Init'), expect('Build'), expect('Deploy'), expect('Test'),
  expect('SDK', expect('Test'), expect('CLI'), expect('GUI')));
