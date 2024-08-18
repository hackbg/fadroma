/* tslint:disable */
/* eslint-disable */
/**
*/
export class Decode {
  free(): void;
/**
* @param {Uint8Array} source
* @returns {bigint}
*/
  static u32(source: Uint8Array): bigint;
/**
* @param {Uint8Array} source
* @returns {bigint}
*/
  static u64(source: Uint8Array): bigint;
/**
* @param {Uint8Array} source
* @returns {Array<any>}
*/
  static vec_string(source: Uint8Array): Array<any>;
/**
* @param {Uint8Array} source
* @returns {string}
*/
  static code_hash(source: Uint8Array): string;
/**
* @returns {object}
*/
  static storage_keys(): object;
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static epoch_duration(source: Uint8Array): object;
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static gas_cost_table(source: Uint8Array): object;
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static tx(source: Uint8Array): object;
/**
* @param {Uint8Array} source
* @returns {string}
*/
  static address(source: Uint8Array): string;
/**
* @param {Uint8Array} source
* @returns {Array<any>}
*/
  static addresses(source: Uint8Array): Array<any>;
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static address_to_amount(source: Uint8Array): object;
/**
* @param {string} block_json
* @param {string} block_results_json
* @returns {object}
*/
  static block(block_json: string, block_results_json: string): object;
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static pos_parameters(source: Uint8Array): object;
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static pos_validator_metadata(source: Uint8Array): object;
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static pos_commission_pair(source: Uint8Array): object;
/**
* @param {Uint8Array} source
* @returns {any}
*/
  static pos_validator_state(source: Uint8Array): any;
/**
* @param {Uint8Array} source
* @returns {any}
*/
  static pos_validator_set(source: Uint8Array): any;
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static pgf_parameters(source: Uint8Array): object;
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static gov_parameters(source: Uint8Array): object;
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static gov_proposal(source: Uint8Array): object;
/**
* @param {Uint8Array} source
* @returns {Array<any>}
*/
  static gov_votes(source: Uint8Array): Array<any>;
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static gov_result(source: Uint8Array): object;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_decode_free: (a: number) => void;
  readonly decode_u32: (a: number, b: number) => void;
  readonly decode_u64: (a: number, b: number) => void;
  readonly decode_vec_string: (a: number, b: number) => void;
  readonly decode_code_hash: (a: number, b: number) => void;
  readonly decode_storage_keys: (a: number) => void;
  readonly decode_epoch_duration: (a: number, b: number) => void;
  readonly decode_gas_cost_table: (a: number, b: number) => void;
  readonly decode_tx: (a: number, b: number) => void;
  readonly decode_address: (a: number, b: number) => void;
  readonly decode_addresses: (a: number, b: number) => void;
  readonly decode_address_to_amount: (a: number, b: number) => void;
  readonly decode_block: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly decode_pos_parameters: (a: number, b: number) => void;
  readonly decode_pos_validator_metadata: (a: number, b: number) => void;
  readonly decode_pos_commission_pair: (a: number, b: number) => void;
  readonly decode_pos_validator_state: (a: number, b: number) => void;
  readonly decode_pos_validator_set: (a: number, b: number) => void;
  readonly decode_pgf_parameters: (a: number, b: number) => void;
  readonly decode_gov_parameters: (a: number, b: number) => void;
  readonly decode_gov_proposal: (a: number, b: number) => void;
  readonly decode_gov_votes: (a: number, b: number) => void;
  readonly decode_gov_result: (a: number, b: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path: InitInput | Promise<InitInput>): Promise<InitOutput>;
