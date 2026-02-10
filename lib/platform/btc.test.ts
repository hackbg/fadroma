#!/usr/bin/env -S deno run --allow-env --allow-read --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1
import Btc from './btc.ts';
import { Test as The } from '../index.ts';
export const testBtcNode = The('Node', Btc, (btc: Btc) => btc.kill());
export const testBtcOps = The('Ops',
  The('Send', 'OP_CHECKSIG'),
  The('Subscribe', 'TX', 'Block'),
  The('Query', 'Block', 'Transaction', 'Address'));
export default The(import.meta, 'Btc', testBtcNode, testBtcOps);
