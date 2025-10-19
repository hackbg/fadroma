#!/usr/bin/env -S deno run --allow-env
import { expect, suite } from '../tester/index.ts';
import { localnet } from './index.ts';
export default suite(import.meta, 'BTC',
  expect('Localnet', async context => {
    context.localnet = await localnet()();
    console.log(context.localnet);
    process.exit(123);
  }),
  expect('Read', expect('Block'), expect('Transaction'), expect('Address')),
  expect('Write', expect('Send')));
