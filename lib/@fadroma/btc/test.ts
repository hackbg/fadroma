#!/usr/bin/env -S deno run --allow-env
import * as Btc from './index.ts';
import { expect, suite } from '@hackbg/fadroma';
export default suite(import.meta, 'BTC',
  expect('Localnet', testLocalnet),
  expect('Read', 'Block', 'Transaction', 'Address'),
  expect('Write', 'Send'),
  stopLocalnet);

export async function withLocalnet (...steps) {
  return expect('Localnet', testLocalnet, ...steps, stopLocalnet);
}

export async function testLocalnet (context) {
  const localnet = Btc.localnet();
  context.localnet = await localnet();
}

export async function stopLocalnet (context) {
  console.log({context});
  context.localnet.kill();
}
