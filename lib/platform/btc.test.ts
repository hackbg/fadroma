#!/usr/bin/env -S deno run --allow-env --allow-read --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1
import { Test } from '../index.ts';
import { Btc } from './btc.ts';
const { the, is, has } = Test;
export const testBtcNode = the('Node', Btc, (btc: Btc) => btc.kill());
export const testBtcOps = the('Ops',
  the('Send', 'OP_CHECKSIG'),
  the('Subscribe', 'TX', 'Block'),
  the('Query', 'Block', 'Transaction', 'Address'));
export default Test.suite(import.meta, 'Btc',
  testBtcNode, testBtcOps);
