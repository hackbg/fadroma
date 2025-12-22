import { Fn, Meta, wasmLoader } from '../index.ts';
import { exit, env, argv, stdout, stderr, fileURLToPath, resolvePath, fetchText,
  } from '../deps.ts';
/** A SimplicityHL program. */
export interface Simf {
  /** Path to program. */
  path: string
  /** Code of program. */
  source (): Promise<string>,
  /** Compile program. */
  compile: Fn<[object?], Promise<Simf>>,
}
/** Define a SimplicityHL program.
  *
  * Example:
  *
  *   #!/usr/bin/env -S deno --allow-read=.
  *   import { Simf } from '@hackbg/fadroma';
  *   const program = Simf('./main.simf');
  *   console.log(await program.spend());
  *
  * */
export function Simf (path: string): Simf;

/** Define a SimplicityHL program as module entrypoint.
  * 
  * When scripts of this form are executed, they provide a CLI. 
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
  const source = () => fetchText(path);
  const program: Simf = {
    path,
    source,
    async compile (options?: object) {
      const [wasm, src] = await Promise.all([Simf.Wasm(), source()]);
      const compiled = wasm.compile(src, options);
      return Object.assign(compiled, compiled.toJSON(), program);
    }
  };
  if ((meta as { main: unknown })?.main) Simf.Cli(program);
  return program as Simf;
}
/** SimplicityHL utilities. */
export namespace Simf {
  /** Simplicity WASM loader. */
  export const Wasm = wasmLoader<Wasm>(
    env['FADROMA_SIMF_WASM']
      || fileURLToPath(import.meta.resolve('./simf/pkg/fadroma_simf_bg.wasm')),
    env['FADROMA_SIMF_WRAP']
      || fileURLToPath(import.meta.resolve('./simf/pkg/fadroma_simf.js')),
  );
  /** Simplicity WASM module. */
  export type Wasm = {
    cmr_to_p2tr: Fn.Returns<string>,
    compile:     Fn<[string, object?], Program>,
    toJSON:      Fn.Returns<object>,
  };
  /** Simplicity program (WASM object). */
  export type Program = {
    toString: Fn.Returns<string>
    toJSON:   Fn.Returns<object>,
    spend:    Fn<[object], Spend>,
  };
  /** Simplicity spend transaction. */
  export type Spend = {
    input:     unknown[]
    output:    unknown[]
    version:   unknown
    lock_time: { block: number }|{ seconds: number }
  };
  /** Simplicity CLI. */
  export const Cli = async function simfCli (program: Simf) {
    const [_, __, command, ..._args] = argv;
    stderr.write(program.toJSON());
    switch (command.trim()) {
      default:
        stderr.write('Commands:\n  build\n  deposit\n  withdraw');
        return exit(1);
    }
    function showOutput (output: unknown) {
      const o = output as { stdout: string, stderr: string };
      stderr.write(o.stderr);
      stdout.write(o.stdout);
      return output;
    }
  }
}
