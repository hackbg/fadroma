import type { Tendermint, Address, Uint128 } from '../deps.ts'

export interface Transaction extends Tendermint.Transaction {
  //readonly block?: Height
  readonly data: {
    readonly expiration?:          string|null
    readonly timestamp?:           string
    readonly feeToken?:            string
    readonly feeAmountPerGasUnit?: string
    readonly multiplier?:          bigint
    readonly gasLimitMultiplier?:  bigint
    readonly atomic?:              boolean
    readonly txType?:              'Raw'|'Wrapper'|'Decrypted'|'Protocol'
    readonly sections?:            object[]
    readonly content?:             Array<object>
    readonly batch?:               Array<{
      readonly hash:     string,
      readonly codeHash: string,
      readonly dataHash: string,
      readonly memoHash: string
    }>
  }
}

export type TxContent = {
  readonly type: 'tx_become_validator.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_bond.wasm'
  readonly data: {
    readonly source:    Address,
    readonly validator: Address,
    readonly amount:    Uint128,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_bridge_pool.wasm'
  readonly data: unknown
} | {
  readonly type: 'tx_change_consensus_key.wasm'
  readonly data: {
    readonly validator: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_change_validator_commission.wasm'
  readonly data: {
    readonly validator: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_change_validator_metadata.wasm'
  readonly data: {
    readonly validator: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_claim_rewards.wasm'
  readonly data: {
    readonly validator: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_deactivate_validator.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_ibc.wasm'
  readonly data: unknown
} | {
  readonly type: 'tx_init_account.wasm'
  readonly data: unknown
} | {
  readonly type: 'tx_init_proposal.wasm'
  readonly data: {
    readonly author: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_reactivate_validator.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_redelegate.wasm'
  readonly data: {
    readonly srcValidator: Address,
    readonly destValidator: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_resign_steward.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
} | TxContentRevealPk | TxContentTransfer | TxContentUnbond | TxContentUnjailValidator | TxContentUpdateAccount | TxContentUpdateStewardCommission | TxContentVoteProposal | TxContentWithdraw | VpImplicit | VpUser | {
  [key: string]: unknown
}

export interface TxContentRevealPk {
  readonly type: 'tx_reveal_pk.wasm'
  readonly data: unknown
}

export interface TxContentTransfer {
  readonly type: 'tx_transfer.wasm'
  readonly data: {
    readonly sources: [{ owner: Address, token: Address }, Uint128][],
    readonly targets: [{ owner: Address, token: Address }, Uint128][],
    readonly [key: string]: unknown
  }
}

export interface TxContentUnbond {
  readonly type: 'tx_unbond.wasm'
  readonly data: {
    readonly source:    Address,
    readonly validator: Address,
    readonly amount:    Uint128,
    readonly [key: string]: unknown
  }
}

export interface TxContentUnjailValidator {
  readonly type: 'tx_unjail_validator.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
}

export interface TxContentUpdateAccount {
  readonly type: 'tx_update_account.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
}

export interface TxContentUpdateStewardCommission {
  readonly type: 'tx_update_steward_commission.wasm'
  readonly data: {
    readonly steward: Address,
    readonly [key: string]: unknown
  }
}

export interface TxContentVoteProposal {
  readonly type: 'tx_vote_proposal.wasm'
  readonly data: {
    readonly voter: Address,
    readonly [key: string]: unknown
  }
}

export interface TxContentWithdraw {
  readonly type: 'tx_withdraw.wasm'
  readonly data: {
    readonly validator: Address,
    readonly [key: string]: unknown
  }
}

export interface VpImplicit {
  readonly type: 'vp_implicit.wasm'
  readonly data: unknown
}

export interface VpUser {
  readonly type: 'vp_user.wasm'
  readonly data: unknown
}
