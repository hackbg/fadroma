/* tslint:disable */
/* eslint-disable */
/**
*/
export class Decode {
  free(): void;
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
/**
* @param {Uint8Array} source
* @returns {object}
*/
  static tx(source: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_become_validator(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_bond(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_change_consensus_key(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_change_validator_commission(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_change_validator_metadata(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_claim_rewards(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_deactivate_validator(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_init_account(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_init_proposal(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_reactivate_validator(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_resign_steward(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_reveal_pk(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_transfer(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_unbond(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_unjail_validator(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_update_account(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_update_steward_commission(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_vote_proposal(binary: Uint8Array): object;
/**
* @param {Uint8Array} binary
* @returns {object}
*/
  static tx_content_withdraw(binary: Uint8Array): object;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_decode_free: (a: number) => void;
  readonly decode_address: (a: number, b: number) => void;
  readonly decode_addresses: (a: number, b: number) => void;
  readonly decode_address_to_amount: (a: number, b: number) => void;
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
  readonly decode_tx: (a: number, b: number) => void;
  readonly decode_tx_content_become_validator: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_bond: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_change_consensus_key: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_change_validator_commission: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_change_validator_metadata: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_claim_rewards: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_deactivate_validator: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_init_account: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_init_proposal: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_reactivate_validator: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_reveal_pk: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_transfer: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_update_account: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_update_steward_commission: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_vote_proposal: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_withdraw: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_unjail_validator: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_unbond: (a: number, b: number, c: number) => void;
  readonly decode_tx_content_resign_steward: (a: number, b: number, c: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
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
