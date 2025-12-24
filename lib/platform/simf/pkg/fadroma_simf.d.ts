/* tslint:disable */
/* eslint-disable */

export class Program {
  private constructor();
/**
** Return copy of self without private attributes.
*/
  toJSON(): Object;
/**
* Return stringified version of self.
*/
  toString(): string;
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Generate a spend transaction.
   */
  spend(options: object): object;
  /**
   * Use this in JS to get the properties of the compiled program.
   */
  toJSON(): object;
  /**
   * Programs have many properties, so we default to
   * just stringifying them to the original source.
   */
  toString(): string;
}

/**
 * Create a SimplicityHL P2TR address from the [Cmr]
 * (Commitment Merkle root) of a compiled Simplicity program.
 */
export function cmr_to_p2tr(cmr: any): string;

/**
 * Compile a SimplicityHL program.
 */
export function compile(source: string, options: object): Program;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_program_free: (a: number, b: number) => void;
  readonly cmr_to_p2tr: (a: any) => [number, number, number];
  readonly compile: (a: any, b: any) => [number, number, number];
  readonly program_spend: (a: number, b: any) => [number, number, number];
  readonly program_toJSON: (a: number) => any;
  readonly program_toString: (a: number) => [number, number];
  readonly rust_0_6_malloc: (a: number) => number;
  readonly rust_0_6_free: (a: number) => void;
  readonly rust_0_6_calloc: (a: number, b: number) => number;
  readonly rustsecp256k1zkp_v0_10_0_default_error_callback_fn: (a: number, b: number) => void;
  readonly rustsecp256k1zkp_v0_10_0_default_illegal_callback_fn: (a: number, b: number) => void;
  readonly rustsecp256k1_v0_10_0_context_create: (a: number) => number;
  readonly rustsecp256k1_v0_10_0_context_destroy: (a: number) => void;
  readonly rustsecp256k1_v0_10_0_default_error_callback_fn: (a: number, b: number) => void;
  readonly rustsecp256k1_v0_10_0_default_illegal_callback_fn: (a: number, b: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
