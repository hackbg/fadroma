#!/usr/bin/env -S deno run --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=localhost
import { btcLocalnet, btcClient, btcDaemon } from './index.ts';
import { ok, equal, expect, testSuite, defer } from '@hackbg/fadroma';
import type { Testing } from '@hackbg/fadroma';

export type TestContext = Testing & { localnet: unknown };

export default testSuite(import.meta, 'BTC',
  expect('Client', testBtcClient),
  expect('Daemon', testBtcDaemon),
  expect('Localnet', testLocalnet,
    expect('Subscribe', 'TX', 'Block'),
    expect('Query', 'Block', 'Transaction', 'Address'),
    expect('Send', 'OP_CHECKSIG'),
    stopLocalnet));

export async function testBtcClient (test: TestContext) {
  const clients = btcClient();
  ok(typeof clients === 'function');
  const client = await clients();
  ok(typeof client  === 'function');
  let mock = null;
  const context = {exec(...args){mock = args}};
  equal(context, await client(context));
  equal(mock, [
    { argv: [ 'bitcoin-cli', '-rpcpassword=fadroma', '-regtest', '-rpcport=18443' ]
    , options: {} } ]);
  //const instance = await invoke({});  equal(instance, {});
}

export async function testBtcDaemon () {
  const daemons = btcDaemon();
  ok(typeof daemons === 'function');
  const daemon = await daemons();
  ok(typeof daemon  === 'function');
  let mock = null;
  const context = {pids: {}, spawn(...args){mock = args; return {}}};
  equal(context, await daemon(context));
  equal(mock, [
    { argv: [ 'bitcoind', '-rpcpassword=fadroma', '-regtest', '-server'
            , '-txindex', '-rpcworkqueue=32', '-rpcport=18443' ]
    , options: {} } ]);
}

export async function testLocalnet (test: TestContext) {
  const timeout  = (_, reject)=>setTimeout(timedOut(reject), 60000);
  const timedOut = reject => () => reject(new Error('timed out waiting for ZMQ'));
  const zmqTest  = defer(timeout);
  const localnet = btcLocalnet({ onZmq: zmqTest.resolve });
  test.localnet  = await localnet();
  console.log('Waiting for ZMQ');
  await zmqTest;
}

export async function stopLocalnet (test: TestContext) {
  test.localnet.kill();
}
