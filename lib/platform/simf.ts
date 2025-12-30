import { Fn, wasmLoader } from '../index.ts';
import { exit, env, argv, stdout, stderr, fileURLToPath } from '../deps.ts';
/** A SimplicityHL program. */
export interface Simf {
  /** Code of program. */
  source: string
  /** Compile program. */
  compile (_?: object): Promise<Simf.Program>;
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
export function Simf (source: string): Simf {
  const program = {
    source,
    async compile (options?: object) {
      const wasm = await Simf.Wasm();
      const compiled = wasm.compile(program.source, options) as Simf.Program;
      return Object.assign(
        compiled,
        compiled.toJSON()
      );
    }
  };
  return program;
}
/** SimplicityHL utilities. */
export namespace Simf {
  /** Simplicity WASM loader. */
  export const Wasm = wasmLoader<Wasm>(
    env['FADROMA_SIMF_WASM'] || fileURLToPath(
      import.meta.resolve('./simf/pkg/fadroma_simf_bg.wasm')),
    env['FADROMA_SIMF_WRAP'] || fileURLToPath(
      import.meta.resolve('./simf/pkg/fadroma_simf.js')),
  );
  /** Simplicity WASM module. */
  export type Wasm = {
    cmr_to_p2tr: Fn.Returns<string>,
    compile:     Fn<[string, object?], Program>,
    toJSON:      Fn.Returns<object>,
  };
  /** Simplicity program (WASM object). */
  export type Program = Simf & {
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
    const compiled = await program.compile();
    stderr.write(JSON.stringify(compiled.toJSON(), null, 2));
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
