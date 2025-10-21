if (globalThis.Deno) {
  await import("https://deno.land/x/indexeddb@v1.1.0/polyfill_memory.ts");
}

export {
  compose, exec, spawn, every, setEnv, arg, waitPort,
  serveTcp, serveHttp, route, param, guard, ware, get, post,
} from '@hackbg/fadroma';

//export * as ZMQ    from 'npm:zeromq';
export { default as Indexd } from 'indexd';
export { BrowserLevel as DB } from 'browser-level';
export * as RPC from 'yajrpc';

import Typeforce from 'typeforce';
export const isHex64 = Typeforce.HexN(64);

import * as BTCJS from 'bitcoinjs-lib';
export const { ECPair, TransactionBuilder } = BTCJS;
export const { sha256 } = BTCJS.crypto;
export const { p2pkh } = BTCJS.payments;
export const { toOutputScript } = BTCJS.address;
