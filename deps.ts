// Node-style builtins:
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
export { ok, throws, rejects, deepStrictEqual as equal } from 'node:assert';
export { setImmediate } from 'node:timers';
export { tmpdir } from 'node:os';
export { fileURLToPath } from 'node:url';
export { inspect } from 'node:util';
export { spawn as spawnImpl } from 'node:child_process';
export type { ChildProcess } from 'node:child_process';
export type { Buffer } from 'node:buffer';
export const webcrypto = globalThis.crypto ?? (await import('node:crypto')).webcrypto;
export const { stdin, stdout, stderr, argv, env, cwd, exit } = process;
export { process };
export { realpathSync } from 'node:fs';
export { mkdir, rm, mkdtemp, writeFile } from 'node:fs/promises';
export const execImpl = promisify(execFile);
export { execFile };
export { dirname
       , join     as joinPath
       , resolve  as resolvePath
       , relative as relativePath } from 'node:path';

// Deno-style builtins:
export type TcpConn = Deno.TcpConn;
export const { connect: denoConnect, listen: denoListen, watchFs } = globalThis.Deno || {};

// Third-party packages:
export { base16, base64, bech32, bech32m } from 'npm:@scure/base'
export { default as Case } from 'npm:case';
//export { Buffer as StreamBuffer } from '@std/streams';

if (globalThis.Deno) {
  await import("https://deno.land/x/indexeddb@v1.1.0/polyfill_memory.ts");
}

export const getIndexd       = () => import('npm:indexd');
export const getBtcJs        = () => import('npm:bitcoinjs-lib');
export const getPbVarint     = () => import('npm:protobuf-varint');
export const getBrowserLevel = () => import('npm:browser-level');

export const getCreateLogUpdate = () =>
  import('npm:log-update').then(c=>c.createLogUpdate);

export async function fetchText (href: string|URL): Promise<string> {
  if (('Deno' in globalThis) && ('readFile' in globalThis.Deno)) {
    return new TextDecoder().decode(await Deno.readFile(new URL(href).pathname))
  }
  if ('fetch' in globalThis) {
    const request = await fetch(href);
    const text = await request.text();
    return text
  }
  throw new Error('fetchText: not available')
}

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
