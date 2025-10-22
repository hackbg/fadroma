#!/usr/bin/env -S deno run --allow-env
import * as Btc from './index.ts';
import { expect, suite } from '@hackbg/fadroma';
import type { TestContext as Context } from '@hackbg/fadroma';
export default suite(import.meta, 'BTC',
  expect('Localnet', testLocalnet),
  expect('Read', 'Block', 'Transaction', 'Address'),
  expect('Write', 'Send'),
  stopLocalnet);

export async function testLocalnet (test: TestContext) {
  const localnet = Btc.localnet();
  test.localnet = await localnet();
}

export async function stopLocalnet (test: TestContext) {
  test.localnet.kill();
}

export type TestContext = Context & { localnet: unknown };
