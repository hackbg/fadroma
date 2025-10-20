import { suite, expect } from '@hackbg/fadroma';
export const name = 'Simplicity';
import * as Simplicity from './index.ts';
export default suite(import.meta, 'Simplicity',
  expect('Deploy'), expect('Invoke'),
  expect('Init'), expect('Build'), expect('Deploy'), expect('Test'),
  expect('SDK', expect('Test'), expect('CLI'), expect('GUI')));
