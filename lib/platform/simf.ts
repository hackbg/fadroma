import { Async, Fn, Meta, Pipe, Exec } from '../index.ts';
import { exit, env, argv, stdout, stderr, dirname,
         fileURLToPath, resolvePath } from '../deps.ts';

/** A SimplicityHL program. */
export interface Simf {
  /** Path to program. */
  path:     string
  /** Build program with `simply build`. */
  build:    Fn.Returns<Async<string>>,
  /** Generate program address with `simply deposit`. */
  deposit:  Fn.Returns<Async<string>>,
  /** Withdraw program balance if it evaluates. */
  withdraw: Fn.Returns<Async<string>>,
}

/** Define a SimplicityHL program. */
export function Simf (path: string): Simf;

/** Define a SimplicityHL program as SDK entrypoint.
  *
  * Example:
  *
  *  #!/usr/bin/env -S deno --allow-read=.
  *  import { Simf } from '@hackbg/fadroma';
  *  export default Simf(import.meta, './main.simf');
  *
  **/
export function Simf (meta: Meta, path: string): Simf;

/** SimplicityHL program constructor. */
export function Simf (...args: unknown[]): Simf {
  if (typeof args[0] === 'string') args.unshift(null);
  let [meta, path] = args as [Meta, ...string[]];
  path = resolvePath(meta?.url ? fileURLToPath(meta?.url) : '', '..', path);
  const pre      = ['--entrypoint', path, '--target-dir', dirname(path)];
  const build    = Pipe(Exec('simply', 'build',   ...pre), parseBuild);
  const deposit  = Pipe(Exec('simply', 'deposit', ...pre), parseDeposit);
  const withdraw = ({ txid = null, dest = null, ...context } = {}) => {
    const args   = ['--txid', txid, '--destination', dest];
    const exec   = Exec('simply', 'withdraw', ...pre, ...args);
    const pipe   = Pipe(exec, parseWithdraw);
    return pipe(context)
  };
  const program: Simf = { path, build, deposit, withdraw };
  if ((meta as { main: unknown })?.main) {
    console.log(program.path);
    Simf.Cli(program);
  }
  return program as Simf;
}

const parseStdout   = (re: RegExp) => ({ stdout }: { stdout: string }) => stdout.match(re)[1];
const parseBuild    = parseStdout(/Build artifacts written to: (.*)\n/);
const parseDeposit  = parseStdout(/P2TR address: (.*)\n/);
const parseWithdraw = parseStdout(/Transaction ID: (.*)\n/);

/** SimplicityHL utilities. */
export namespace Simf {

  /** Simplicity CLI wrapper. */
  export const Cli = async function simfCli (simf: Simf) {
    const [_, __, command, ..._args] = argv;

    switch (command.trim()) {
      case undefined:
        stderr.write('Commands:\n  build\n  deposit\n  withdraw');
        return exit(1);
      case 'build': return Promise.resolve(simf.build())
        .then(showOutput);
      case 'deposit': return Promise.resolve(simf.deposit())
        .then(showOutput); 
      case 'withdraw': return Promise.resolve(simf.withdraw())
        .then(showOutput);
      default:
        throw new Error(`invalid command: ${command}`)
    }

    function showOutput (output: unknown) {
      const o = output as { stdout: string, stderr: string };
      stderr.write(o.stderr);
      stdout.write(o.stdout);
      return output;
    }
  }

  /** Simplicity WASM loader. */
  export const Wasm = async function simfWasm (
    wasm: string|URL|Uint8Array = env['FADROMA_SIMF_WASM']
  ): Promise<unknown> {
    const module = await import('./simf/pkg/fadroma_simf_bg.js');
    const init = (module as unknown as { default: Fn }).default
    if (wasm instanceof Uint8Array) {
      await init(wasm)
    } else if (wasm) {
      await init(await fetch(wasm))
    } else {
      throw new Error('Provide wasm as path, URL or Uint8Array')
    }
    return module;
  }

}
