#!/usr/bin/env -S deno run --allow-env --allow-read --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1
import { Fn, Test } from '../index.ts';
import { resolvePath } from '../deps.ts';
import { Btc } from './btc.ts';

const { the, is, has } = Test;
const wasmPath = resolvePath(import.meta.dirname, "btc/pkg/fadroma_btc_bg.wasm");
const testBtcWasmInit = (init: Fn) => {
  init();
}
const testBtcWasmCmr2P2TR = (cmrToP2TR: Fn) => {
  cmrToP2TR();
  cmrToP2TR("c40a10263f7436b4160acbef1c36fba4be4d95df181a968afeab5eac247adff7");
}
export const testBtcWasm = the('WASM',
  () => Deno.readFile(wasmPath),
  (wasm: Uint8Array) => Btc.Wasm(wasm),
  has('default',     is('function'), testBtcWasmInit),
  has('cmr_to_p2tr', is('function'), testBtcWasmCmr2P2TR));

export const testBtcCli = the('CLI',
  () => Btc().execCli(), is('function'), has('entries',
    is('object', 'Array'),
    has('0', is('function'),
      has('command', 'bitcoin-cli'),
      has('options', is('object', 'Array')))),
  calledWithMock,
  is('object'));

export const testBtcNode = the('Node',
  () => Btc().spawnNode(), is('function'), has('services',
    has('length', 2)));

export const testBtcOps =  the('Ops',
    the('Send', 'OP_CHECKSIG'),
    the('Subscribe', 'TX', 'Block'),
    the('Query', 'Block', 'Transaction', 'Address'));

export default Test.suite(import.meta, 'Btc',
  testBtcWasm,
  testBtcCli,
  testBtcNode,
  testBtcOps);

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
