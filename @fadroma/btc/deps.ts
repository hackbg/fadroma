if (globalThis.Deno) {
  await import("https://deno.land/x/indexeddb@v1.1.0/polyfill_memory.ts");
}

//export * as ZMQ    from 'npm:zeromq';
export { default as Indexd } from 'indexd';
export { BrowserLevel as DB } from 'browser-level';
export * as RPC from 'yajrpc';

import Typeforce from 'typeforce';
export const isHex64 = Typeforce.HexN(64);

export * as BTCJS from 'bitcoinjs-lib';

export { setImmediate } from 'node:timers';
export type * from '@hackbg/fadroma';
export {
  interval, Env, Arg, portWait,
  serveHttp, route, param, guard, get, post,
  joined, call, reflect,
  toU8A, flag, byteParse, byteConcat, readBytes,
  readUntilDone, write, toRW, tcpConnect, tcpListen, merge, sequence,
  pipe,
  Test, Service, Exec, Spawn, Dir, Port, UTF8,
} from '@hackbg/fadroma';
