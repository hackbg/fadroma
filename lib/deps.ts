//export { Buffer as StreamBuffer } from '@std/streams';
export { ok, throws, rejects, deepStrictEqual as equal } from 'node:assert';
export { setImmediate, } from 'node:timers';
export { tmpdir } from 'node:os';
export { fileURLToPath } from 'node:url';
export { inspect, stripVTControlCharacters } from 'node:util';
export { spawn as spawnImpl } from 'node:child_process';
export type { ChildProcess } from 'node:child_process';
export type { Buffer } from 'node:buffer';
export { createServer as createHttpServer,
  Server as HttpServer } from 'node:http';
export { createServer as createTcpServer, createConnection,
  Server as TcpServer, Socket } from 'node:net';

export const webcrypto = globalThis.crypto ?? (await import('node:crypto')).webcrypto;

import process from 'node:process';
export { process };
export const { stdout, stderr, argv, env, cwd, exit } = process;

export { realpathSync } from 'node:fs';
export { mkdir, rm, mkdtemp, writeFile } from 'node:fs/promises';
import { join as joinPath, resolve as resolvePath, relative as relativePath, } from 'node:path';
export { joinPath, resolvePath, relativePath }

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
export const execImpl = promisify(execFile);
export { execFile };
export const {
  connect: denoConnect, listen: denoListen, watchFs
} = globalThis.Deno || {};

export type TcpConn = Deno.TcpConn;

export { base16, base64, bech32, bech32m } from '@scure/base'
export { default as Case } from 'case';
export const getCreateLogUpdate = () =>
  import('log-update').then(c=>c.createLogUpdate)

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
if (globalThis.Deno) {
  await import("https://deno.land/x/indexeddb@v1.1.0/polyfill_memory.ts");
}

//export * as ZMQ    from 'npm:zeromq';
export { default as Indexd } from 'indexd';
export { BrowserLevel as DB } from 'browser-level';

export * as BTCJS from 'bitcoinjs-lib';

export { uint32 } from 'protobuf-varint';

/** A parse that may fail but the source and error must still be preserved. */
export type TryToParse<T, U> =
  | [T, U,         undefined]
  | [T, undefined, unknown];

/** Show a stringified object. */
export const tryToParse = <T, U>(src: T): TryToParse<T, U> => {
  try {
    const json = JSON.parse(src as string)
    return [src, json, undefined]
  } catch (e) {
    return [src, undefined, e]
  }
};

export { zipSync } from 'fflate';
