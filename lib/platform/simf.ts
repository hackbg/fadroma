import { Meta, Pipe, Exec } from '../index.ts';
import { exit, env, fileURLToPath, resolvePath, argv, stdout, stderr, dirname } from '../deps.ts';

/** Simplicity program. */
export interface Simf {
  /** Path to program. */
  path:     string
  build:    () => Promise<string>,
  deposit:  () => Promise<string>,
  withdraw: () => Promise<string>,
}

/** Define Simplicity program. */
export function Simf (path: string): Simf;
/** Define Simplicity program as SDK entrypoint. */
export function Simf (meta: Meta, path: string): Simf;
/** Simplicity program constructor. */
export function Simf (...args: unknown[]): Simf {
  if (typeof args[0] === 'string') args.unshift(null);
  let [meta, path] = args as [Meta, ...string[]];
  path = resolvePath(meta?.url ? fileURLToPath(meta?.url) : '', '..', path);
  const pre = ['--entrypoint', path, '--target-dir', dirname(path)];
  const simf: Simf = {
    path,
    build: Pipe(
      Exec('simply', 'build',    ...pre),
      ({ stdout }: { stdout: string }) => {
        const [_, path] = stdout.match(Simf.RE_BUILD);
        return path;
      }),
    deposit: Pipe(
      Exec('simply', 'deposit',  ...pre),
      ({ stdout }: { stdout: string }) => {
        const [_, p2tr] = stdout.match(Simf.RE_DEPOSIT);
        return p2tr;
      }),
    withdraw: ({ txid = null, dest = null } = {}) => Pipe(
      Exec('simply', 'withdraw', ...pre, '--txid', txid, '--destination', dest),
      ({ stdout }: { stdout: string }) => {
        const [_, txid] = stdout.match(Simf.RE_WITHDRAW);
        return txid;
      })(),
  };
  if (meta?.main) {
    console.log(simf.path);
    Simf.Cli(simf);
  }
  return simf as Simf;
}

Simf.RE_BUILD    = /Build artifacts written to: (.*)\n/;
Simf.RE_DEPOSIT  = /P2TR address: (.*)\n/;
Simf.RE_WITHDRAW = /Transaction ID: (.*)\n/;

/** Simplicity CLI wrapper. */
Simf.Cli = async function simfCli (simf: Simf) {
  const [_, __, command, ...args] = argv;
  switch (command.trim()) {
    case undefined:  stderr.write('Commands:\n  build\n  deposit\n  withdraw'); return exit(1);
    case 'build':    return Promise.resolve(simf.build()).then(showOutput);
    case 'deposit':  return Promise.resolve(simf.deposit()).then(showOutput); 
    case 'withdraw': return Promise.resolve(simf.withdraw()).then(showOutput);
    default: throw new Error(`invalid command: ${command}`)
  }
  function showOutput (output: unknown) {
    const o = output as { stdout: string, stderr: string };
    stderr.write(o.stderr);
    stdout.write(o.stdout);
    return output;
  }
}

/** Simplicity WASM loader. */
Simf.Wasm = async function loadSimfWasm (
  wasm: string|URL|Uint8Array = env['FADROMA_SIMF_WASM']
): Promise<unknown> {
  const module = await import('./simf/pkg/fadroma_simf.js');
  if (wasm instanceof Uint8Array) {
    await module.default(wasm)
  } else if (wasm) {
    await module.default(await fetch(wasm))
  } else {
    throw new Error('Provide wasm as path, URL or Uint8Array')
  }
  Simf.Wasm = async () => module;
  return module;//Decode as unknown as Decoder;
}
