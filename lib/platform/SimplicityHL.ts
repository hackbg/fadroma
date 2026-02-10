import type Btc from './Bitcoin.ts';
import Fn from '../format/Fn.ts';
import WasmLoader from '../format/Wasm.ts';
import { exit, env, argv, stdout, stderr } from 'node:process';
export default Simf;
/** A SimplicityHL program. */
interface Simf {
  /** Code of program. */
  source: string
  /** Compile program. */
  compile (_?: object): Promise<Simf.Program>
}
/** Define a SimplicityHL program.
  *
  * Example:
  *
  *   #!/usr/bin/env -S deno --allow-read=.
  *   import { Btc, Simf } from '@hackbg/fadroma';
  *   
  *   // Connect:
  *   const { rpc, rest } = await Btc.LiquidTestnet();
  *
  *   // Compile:
  *   const program = await Simf('...source...').compile();
  *   
  *   // Deploy:
  *   const you = 'tex1000000000000000000000000000000000000000';
  *   console.log(await program.fund({ rpc, rest, tx, witness, from: you, amount: 1, fee: 1e-4 }));
  *   
  *   // Invoke:
  *   const witness = { ...see tests for example witness data... };
  *   console.log(await program.spend({ rpc, rest, tx, witness, to: you, amount: 1, fee: 1e-4 }));
  *
  **/
function Simf (source: string): Simf {
  const program = {
    source,
    async compile (options?: object) {
      const wasm      = await Simf.Wasm();
      const compiled  = wasm.compile(program.source, options) as Simf.Program;
      const inspected = compiled.toJSON();
      const methods   = { fund, spend };
      return Object.assign(compiled, program, inspected, methods);
      async function fund ({ rpc, rest, tx, amount, fee, witness, from }: Simf.RpcCtx & Simf.Fund) {
        const fund = compiled.tx_fund({ tx, amount, fee, witness, from });
        return await rest.tx(await rpc.sendrawtransaction(fund.hex));
      }
      async function spend ({ rpc, rest, tx, amount, fee, witness, to }: Simf.RpcCtx & Simf.Spend) {
        const spend = compiled.tx_spend({ tx, amount, fee, witness, to });
        return await rest.tx(await rpc.sendrawtransaction(spend.hex));
      }
    }
  };
  return program;
}
/** SimplicityHL utilities. */
namespace Simf {
  export type Tx     = unknown;
  export type TxCtx  = { tx: Tx, amount, fee, witness? };
  export type RpcCtx = { rpc, rest };
  export type Fund   = TxCtx & { from: string }
  export type Spend  = TxCtx & { to:   string };
  /** SimplicityHL WASM module API. */
  export type Wasm = {
    cmr_to_p2tr: Fn.Returns<string>,
    compile:     Fn<[string, object?], Program>,
    toJSON:      Fn.Returns<object>,
  };
  /** Load SimplicityHL WASM module. */
  export function Wasm (
    wasm = env['FADROMA_SIMF_WASM'] || import.meta.resolve('./SimplicityHL/pkg/fadroma_simf_bg.wasm'),
    wrap = env['FADROMA_SIMF_WRAP'] || import.meta.resolve('./SimplicityHL/pkg/fadroma_simf.js'),
  ) {
    return WasmLoader<Wasm>(wasm, wrap)()
  }
  /** Transaction returned by SimplicityHL WASM module. */
  export type WasmTx = {
    hex:         string,
    bytes:       Uint8Array,
    decoded:     {
      input:     unknown[]
      output:    unknown[]
      version:   unknown
      lock_time: { block: number }|{ seconds: number }
    }
  };
  /** Compiled SimplicityHL program (WASM object). */
  export interface Program extends Simf {
    toString (): object
    toJSON   (): object
    /** Transfer funds to program. */
    fund     (_: Btc & Fund):  Promise<string>
    tx_fund  (_: Fund):        WasmTx
    /** Transfer funds from program. */
    spend    (_: Btc & Spend): Promise<string>
    tx_spend (_: Spend):       WasmTx
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
