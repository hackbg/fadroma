export { ok, deepStrictEqual as equal, throws, rejects } from 'node:assert';
export { setImmediate } from 'node:timers';
export { tmpdir } from 'node:os';
export { stdout, argv, env, cwd as getCwd, exit } from 'node:process';
export { fileURLToPath } from 'node:url';
export { join as joinPath, resolve as resolvePath } from 'node:path';
export { writeFile, mkdir, mkdtemp } from 'node:fs/promises';
export { Server as HttpServer } from 'node:http';
export { Server as TcpServer, createConnection } from 'node:net';
export type { Socket } from 'node:net';
export { inspect } from 'node:util';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
export const execImpl = promisify(execFile);
export { spawn as spawnImpl } from 'node:child_process';
export { base16, base64 } from '@scure/base'
export type { ChildProcess } from 'node:child_process';
export { default as Case } from 'case';
//export { Buffer as StreamBuffer } from '@std/streams';
export type { Buffer } from 'node:buffer';

export const {
  connect: denoConnect,
  listen:  denoListen,
} = globalThis.Deno || {};

export type TcpConn = Deno.TcpConn;
