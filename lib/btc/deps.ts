export {
  compose, shell, spawn, every, setEnv, arg, run,
  serve, rest, ware, get, post,
} from '@fadroma/spawn';

//export * as ZMQ    from 'npm:zeromq';
export * as Indexd from 'npm:indexd';
export const DB = {};
//export * as DB     from 'npm:level';
export * as RPC    from 'npm:yajrpc';

import Typeforce from 'npm:typeforce';
export const isHex64 = Typeforce.HexN(64);

import * as BTCJS from 'npm:bitcoinjs-lib';
export const { ECPair, TransactionBuilder } = BTCJS;
export const { sha256 } = BTCJS.crypto;
export const { p2pkh } = BTCJS.payments;
export const { toOutputScript } = BTCJS.address;
