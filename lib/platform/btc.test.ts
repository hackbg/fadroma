#!/usr/bin/env -S deno run --allow-env --allow-read --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1
import { Fn, Test } from '../index.ts';
import { Btc } from './btc.ts';
const { the, is, has } = Test;
export const testBtcNode = the('Node',
  () => Btc().spawnNode(),
  is('function'), has('services',
    has('length', 2)));
export const testBtcOps = the('Ops',
  the('Send', 'OP_CHECKSIG'),
  the('Subscribe', 'TX', 'Block'),
  the('Query', 'Block', 'Transaction', 'Address'));
export default Test.suite(import.meta, 'Btc',
  testBtcCli, testBtcNode, testBtcOps);

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
