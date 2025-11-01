#!/usr/bin/env -S deno run --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=localhost
import { btcLocalnet, btcClient, btcDaemon } from './index.ts';
import { reflect, call, must, ok, equal, expect, testSuite, defer } from '@hackbg/fadroma';
import type { Testing } from '@hackbg/fadroma';

export type TestContext = Testing & { localnet: unknown };

const _ = undefined;
const mockExecContext  = () => ({ exec  (...args) { this.mock = args; return {} } });
const mockSpawnContext = () => ({ spawn (...args) { this.mock = args; return {} } });
const zmqTimeout = (t = 1000) => {
  const timeout  = (_, reject)=>setTimeout(timedOut(reject), t);
  const timedOut = reject => () => reject(new Error('timed out waiting for ZMQ'));
  return defer(timeout);
}

export default testSuite(import.meta, 'BTC',

  expect('Client',
    expect('Template', call(btcClient, _),
      must.be('function'),
      must.have('name', 'bitcoin-cli')),
    expect('Constructor', call(call(btcClient, _), _),
      must.be('function'),
      must.have('name', 'bitcoin-cli')),
    expect('Instance', call(call(call(btcClient, _), _), mockExecContext()),
      must.be('object'),
      must.have('mock', [
        { argv: [ 'bitcoin-cli', '-rpcpassword=fadroma', '-regtest', '-rpcport=18443' ]
        , opts: {} }
      ]))),

  expect('Daemon',
    expect('Template',    call(btcDaemon, _),               must.be('function')),
    expect('Constructor', call(call(btcDaemon, _), _),      must.be('function')),
    expect('Instance',    call(call(call(btcDaemon, _), _), mockSpawnContext()),
      must.be('object'),
      must.have('mock', [
        { argv: [ 'bitcoind', '-rpcpassword=fadroma', '-regtest', '-server'
                , '-txindex', '-rpcworkqueue=32', '-rpcport=18443' ]
        , opts: {} }
      ]))),

  expect('Localnet',
    reflect('ZMQ timer', ctx => { ctx.zmqTest  = zmqTimeout() }),
    reflect('Launch',    ctx => { ctx.localnet = btcLocalnet({ onZmq: ctx.zmqTest.resolve }) }),
    reflect('Timeout',   async ctx => { await ctx.zmqTest }),
    reflect('Ready',     async ctx => { ctx.localnet = await ctx.localnet }),
    expect('Subscribe', 'TX', 'Block'),
    expect('Query', 'Block', 'Transaction', 'Address'),
    expect('Send', 'OP_CHECKSIG'),
    ctx => ctx.localnet?.kill()));
