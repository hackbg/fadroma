import { Fn, Meta, Pipe, Exec, Spawn } from '../index.ts';
import type { ChildProcess } from '../deps.ts';
import { exit, env, fileURLToPath, resolvePath, argv, stdout, stderr, dirname } from '../deps.ts';
/** Simplicity program. */
export interface Simf {
  /** Path to program. */
  path:     string
  build:    Fn.Returns<Promise<string>>,
  deposit:  Fn.Returns<Promise<string>>,
  withdraw: Fn.Returns<Promise<string>>,
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
    build:   Pipe(Exec('simply', 'build',    ...pre), parseBuild),
    deposit: Pipe(Exec('simply', 'deposit',  ...pre), parseDeposit),
    withdraw: ({ txid = null, dest = null, ...context } = {}) => Pipe(
      Exec('simply', 'withdraw', ...pre, '--txid', txid, '--destination', dest),
      parseWithdraw
    )(context),
  };
  if (meta?.main) {
    console.log(simf.path);
    Simf.Cli(simf);
  }
  return simf as Simf;
}
const parseStdout   = (re: RegExp) => ({ stdout }: { stdout: string }) => stdout.match(re)[1];
const parseBuild    = parseStdout(/Build artifacts written to: (.*)\n/);
const parseDeposit  = parseStdout(/P2TR address: (.*)\n/);
const parseWithdraw = parseStdout(/Transaction ID: (.*)\n/);
/** Simplicity localnet. */
Simf.Localnet = async function simfLocalnet <T> (
  callback: Fn<[ChildProcess], T>
): Promise<T> {
  const spawn = Spawn('elementsd', ...[
    '-datadir=/tmp/fadroma/elements',
    '-debug=rpc',
    '-debug=zmq',
    '-chain=liquidtestnet',
    '-rest=1',
    '-discover=0',
    '-txindex=1',
    '-persistmempool=0',
    '-rpcport=8941'
    //'-regtest',
  ]);
  const daemon = await spawn();
  try {
    return await callback(daemon);
  } finally {
    daemon.kill();
  }
}
/** Simplicity CLI wrapper. */
Simf.Cli = async function simfCli (simf: Simf) {
  const [_, __, command, ..._args] = argv;
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
  const module = await import('./simf/pkg/fadroma_simf_bg.js');
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
