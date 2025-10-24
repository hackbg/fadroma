#!/usr/bin/env -S deno run --allow-env --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443
import * as Btc from './index.ts';
import { expect, suite, defer } from '@hackbg/fadroma';
import type { Testing } from '@hackbg/fadroma';

export type TestContext = Testing & { localnet: unknown };

export default suite(import.meta, 'BTC',
  expect('Localnet', testLocalnet,
    expect('Subscribe', 'TX', 'Block'),
    expect('Query', 'Block', 'Transaction', 'Address'),
    expect('Send', 'Send'),
    stopLocalnet));

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
