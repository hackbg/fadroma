#!/usr/bin/env -S deno run --allow-env
import * as Btc from './index.ts';
import { expect, suite, defer } from '@hackbg/fadroma';
import type { TestContext as Context } from '@hackbg/fadroma';

export default suite(import.meta, 'BTC',
  expect('Localnet', testLocalnet),
  expect('Read', 'Block', 'Transaction', 'Address'),
  expect('Write', 'Send'),
  expect('Stop localnet', stopLocalnet));

export async function testLocalnet (test: TestContext) {
  const timeout  = (_, reject)=>setTimeout(timedOut(reject), 10000);
  const timedOut = reject => () => reject(new Error('timed out waiting for ZMQ'));
  const zmqTest  = defer(timeout);
  const localnet = Btc.localnet({ onZmqPub: zmqTest.resolve });
  test.localnet  = await localnet();
  console.log('Waiting for ZMQ');
  await zmqTest;
}

export async function stopLocalnet (test: TestContext) {
  test.localnet.kill();
}

export type TestContext = Context & { localnet: unknown };
