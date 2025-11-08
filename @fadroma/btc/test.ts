#!/usr/bin/env -S deno run --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1
import { Btc } from './btc.ts';
import { Test, merge } from '@hackbg/fadroma';
const { the, suite, is, has } = Test;
export type TestContext = Test.Context & { localnet: unknown };
export default suite(import.meta, 'Btc',
  the('CLI', () => Btc().execCli,
    is('function', 'Exec(bitcoin-cli)'),
    cli => cli(mockExecContext()),
    is('object', 'Array'),
    has('0', is('object', 'Array'), has('0', is('string', 'bitcoin-cli')))),
  the('Node', btc => Btc().spawnNode(),
    is('function', 'Spawn(bitcoind)'),
    has('services', has('length', 2))),
  the('Localnet', btc => Btc().localnet(),
    the('Send', 'OP_CHECKSIG'),
    the('Subscribe', 'TX', 'Block'),
    the('Query',
      'Block', 'Transaction', 'Address'),
    cleanup));

function cleanup (_, ctx) {
  if (ctx.localnet?.kill) ctx.localnet.kill()
}

function mockExecContext () {
  const mock = [];
  return merge(mock, { exec (...args) { mock.push(args); return {} } })
}

function mockSpawnContext () {
  const mock = []
  return merge(mock, { spawn (...args) { mock.push(args); return {} } });
}
