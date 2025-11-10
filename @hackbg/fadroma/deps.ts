//export { Buffer as StreamBuffer } from '@std/streams';
export { ok, throws, rejects, deepStrictEqual as equal } from 'node:assert';
export type { Buffer } from 'node:buffer';
export { setImmediate, } from 'node:timers';
export { tmpdir } from 'node:os';
export { stdout, stderr, argv, env, cwd as getCwd, exit } from 'node:process';
export { fileURLToPath } from 'node:url';
export { join as joinPath
       , resolve as resolvePath
       , relative as relativePath } from 'node:path';
export { realpathSync } from 'node:fs';
export { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
export { Server as HttpServer
       , createServer as createHttpServer } from 'node:http';
export { Server as TcpServer
       , Socket
       , createServer as createTcpServer
       , createConnection } from 'node:net';
export { inspect, stripVTControlCharacters } from 'node:util';
export { spawn as spawnImpl } from 'node:child_process';
export type { ChildProcess } from 'node:child_process';
export { webcrypto } from 'node:crypto';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
export const execImpl = promisify(execFile);
export { execFile };

export const {
  connect: denoConnect,
  listen:  denoListen,
  watchFs,
} = globalThis.Deno || {};

export type TcpConn = Deno.TcpConn;

export { base16, base64, bech32, bech32m } from '@scure/base'
export { default as Case } from 'case';
export { createLogUpdate } from 'log-update';

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
