#!/usr/bin/env -S deno run --allow-env
import * as Btc from './index.ts';
import { expect, suite } from '@hackbg/fadroma';
export default suite(import.meta, 'BTC',
  expect('Localnet', testLocalnet),
  expect('Read',
    expect('Block'),
    expect('Transaction'),
    expect('Address')),
  expect('Write',
    expect('Send')));

export async function testLocalnet (context) {
  const localnet = Btc.localnet();
  context.localnet = await localnet();
  return context;
}
