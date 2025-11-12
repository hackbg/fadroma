#!/usr/bin/env -S deno run --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1
import { Fn, Test } from '../index.ts';
import { Btc } from './btc.ts';
const { the, suite, is, has } = Test;
export default suite(import.meta, 'Btc',

  the('CLI', () => Btc().execCli(), is('function'),
    has('contents', is('object', 'Array'),
      has('0', is('function'),
        has('argv', is('object', 'Array'),
          has('0', is('string', 'bitcoin-cli'))))),
    calledWithMock,
    is('object')),

  the('Node', btc => Btc().spawnNode(),
    is('function'),
    has('services', has('length', 2))),

  the('Localnet',
    the('Send', 'OP_CHECKSIG'),
    the('Subscribe', 'TX', 'Block'),
    the('Query', 'Block', 'Transaction', 'Address')));

function cleanup (_, ctx: Test.Testing & { localnet?: { kill?: Fn } }) {
  if (ctx.localnet?.kill) ctx.localnet.kill()
}
function calledWithMock (fn) {
  return fn(mockContext());
}
function mockContext () {
  const mock = [];
  return {
    mock,
    exec  (...args) { mock.push(args); return {} },
    spawn (...args) { mock.push(args); return {} },
  }
}
