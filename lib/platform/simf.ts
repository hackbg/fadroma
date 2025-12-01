import { Meta } from '../index.ts';
import { Exec } from '../context.ts';
import { env, fileURLToPath, resolvePath, argv, stdout, stderr, dirname } from '../deps.ts';

/** Simplicity program. */
export interface Simf {
  /** Path to program. */
  path:     string
  build:    Exec
  deposit:  Exec
  withdraw: Exec
}

/** Simplicity program constructor. */
export const Simf: {
  /** Define Simplicity program. */
  (path: string): Simf;
  /** Define Simplicity program as SDK entrypoint. */
  (meta: Meta, path: string): Simf;
} = function Simf (...args: unknown[]): Simf {
  if (typeof args[0] === 'string') args.unshift(null);
  let [meta, path] = args as [Meta, ...string[]];
  path = resolvePath(meta?.url ? fileURLToPath(meta?.url) : '', '..', path);
  const pre = ['--entrypoint', path, '--target-dir', dirname(path)];
  const simf: Simf = {
    path,
    build:    Exec('simply', 'build',    ...pre),
    deposit:  Exec('simply', 'deposit',  ...pre),
    withdraw: Exec('simply', 'withdraw', ...pre, '--txid', 'TODO', '--destination', 'TODO')
  };
  if (meta?.main) {
    console.log(simf.path);
    simfCli(simf);
  }
  return simf as Simf;
}

/** Simplicity WASM-based builder. */
Simf.Wasm = async function loadSimfWasm (
  wasm: string|URL|Uint8Array = env['FADROMA_SIMF_WASM']
): Promise<Decoder> {
  const { default: init, Decode } = await import('./simf/pkg/fadroma_simf.js');
  if (wasm instanceof Uint8Array) {
    await init(wasm)
  } else if (wasm) {
    await init(await fetch(wasm))
  } else {
    throw new Error('Provide wasm as path, URL or Uint8Array')
  }
  Simf.Wasm = async () => Decode as unknown as Decoder;
  return Decode as unknown as Decoder;
}

/** Simplicity CLI wrapper. */
Simf.Cli = async function simfCli (simf: Simf) {
  const [_, __, command, ...args] = argv;
  switch (command.trim()) {
    case undefined:  stderr.write(' build  deposit  withdraw');         break;
    case 'build':    Promise.resolve(simf.build()).then(showOutput);    break;
    case 'deposit':  Promise.resolve(simf.deposit()).then(showOutput);  break;
    case 'withdraw': Promise.resolve(simf.withdraw()).then(showOutput); break;
    default: throw new Error(`invalid command: ${command}`) }
  function showOutput (output: unknown) {
    const o = output as { stdout: string, stderr: string };
    stderr.write(o.stderr);
    stdout.write(o.stdout);
    return output;
  }
}
