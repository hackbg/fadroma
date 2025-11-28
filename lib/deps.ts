//export { Buffer as StreamBuffer } from '@std/streams';
export { ok, throws, rejects, deepStrictEqual as equal } from 'node:assert';
export { setImmediate, } from 'node:timers';
export { tmpdir } from 'node:os';
export { fileURLToPath } from 'node:url';
export { inspect, stripVTControlCharacters } from 'node:util';
export { spawn as spawnImpl } from 'node:child_process';
export type { ChildProcess } from 'node:child_process';
export type { Buffer } from 'node:buffer';

export { createServer as createTcpServer
       , createConnection
       , Server as TcpServer
       , Socket } from 'node:net';

export { createServer as createHttpServer
       , Server as HttpServer } from 'node:http';

export const webcrypto =
  globalThis.crypto ?? (await import('node:crypto')).webcrypto;

import process from 'node:process';
export { process };
export const { stdin, stdout, stderr, argv, env, cwd, exit } = process;

export { realpathSync } from 'node:fs';
export { mkdir, rm, mkdtemp, writeFile } from 'node:fs/promises';
export { dirname
       , join     as joinPath
       , resolve  as resolvePath
       , relative as relativePath } from 'node:path';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
export const execImpl = promisify(execFile);
export { execFile };
export const {
  connect: denoConnect, listen: denoListen, watchFs
} = globalThis.Deno || {};

export type TcpConn = Deno.TcpConn;

export { default as Case } from 'case';
export const getCreateLogUpdate = () =>
  import('log-update').then(c=>c.createLogUpdate)
if (globalThis.Deno) {
  await import("https://deno.land/x/indexeddb@v1.1.0/polyfill_memory.ts");
}

//export * as ZMQ    from 'npm:zeromq';
export const getIndexd       = () => import('indexd');

export const getBrowserLevel = () => import('browser-level');

export const getBtcJs        = () => import('bitcoinjs-lib');

export const getPbVarint     = () => import('protobuf-varint');

export { base16, base64, bech32, bech32m } from '@scure/base'

export { zipSync, strToU8 as zipStr } from 'fflate';

//export { sha256 } from '@noble/hashes/sha2.js'
//export { ripemd160 } from '@noble/hashes/legacy.js'
//export { ed25519 } from '@noble/ed25519'
//export { secp256k1 } from '@noble/secp256k1'
//export {
  //numberToBytesBE as toBE,
  //numberToBytesLE as toLE,
//} from '@noble/curves/abstract/utils'
//export * as bip32 from '@scure/bip32'
//export * as bip39 from '@scure/bip39'
//export { wordlist as bip39_EN } from '@scure/bip39/wordlists/english'
