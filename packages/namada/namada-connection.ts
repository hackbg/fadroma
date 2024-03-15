import * as CW from '@fadroma/cw'
import init, { Decode } from './pkg/fadroma_namada.js'
import {
  getTotalStaked,
  getStakingParameters,
  getValidators,
  getValidatorsConsensus,
  getValidatorsBelowCapacity,
  getValidatorAddresses,
  getValidator,
  getValidatorStake,
} from './namada-pos'
import {
  getGovernanceParameters,
  getProposalCount,
  getProposalInfo
} from './namada-gov'
import {
  getCurrentEpoch
} from "./namada-epoch";
import {
  getPGFParameters,
  getPGFStewards,
  getPGFFundings,
  isPGFSteward
} from "./namada-pgf"
import {
  NamadaTransaction,
  UndecodedNamadaTransaction
} from './namada-tx'

export async function connect (optionsWithDecoder: ConstructorParameters<typeof NamadaConnection>[0] & {
  decoder: string|URL|Uint8Array
}) {
  let { decoder, ...options } = optionsWithDecoder
  if (decoder) {
    await initDecoder(decoder)
  }
  return new NamadaConnection(options)
}

export async function initDecoder (decoder: string|URL|Uint8Array) {
  if (decoder instanceof Uint8Array) {
    await init(decoder)
  } else if (decoder) {
    await init(await fetch(decoder))
  }
}

export { Decode }

export class NamadaConnection extends CW.Connection {

  decode = Decode

  async getBlock (height?: number) {
    const block = await super.getBlock(height)
    const txsDecoded: NamadaTransaction[] = []
    const {txs} = (block as { txs: Uint8Array[] })
    for (const i in txs) {
      const binary = txs[i].slice(3)
      try {
        txsDecoded[i] = NamadaTransaction.fromDecoded(Decode.tx(binary) as any)
      } catch (error) {
        txsDecoded[i] = new UndecodedNamadaTransaction({ binary, error })
      }
    }
    Object.assign(block, { txsDecoded })
    return block as typeof block & { txsDecoded: NamadaTransaction[] }
  }

  getPGFParameters () {
    return getPGFParameters(this)
  }

  getPGFStewards () {
    return getPGFStewards(this)
  }

  getPGFFundings () {
    return getPGFFundings(this)
  }

  isPGFSteward (address: string) {
    return isPGFSteward(this)
  }

  getStakingParameters () {
    return getStakingParameters(this)
  }

  getValidatorAddresses () {
    return getValidatorAddresses(this)
  }

  getValidators (options?: {
    details?:    boolean,
    pagination?: [number, number]
    allStates?:  boolean,
    addresses?:  string[],
  }) {
    return getValidators(this, options)
  }

  getValidatorsConsensus () {
    return getValidatorsConsensus(this)
  }

  getValidatorsBelowCapacity () {
    return getValidatorsBelowCapacity(this)
  }

  getValidator (address: string) {
    return getValidator(this, address)
  }

  getGovernanceParameters () {
    return getGovernanceParameters(this)
  }

  getProposalCount () {
    return getProposalCount(this)
  }

  getProposalInfo (id: number) {
    return getProposalInfo(this, id)
  }

  getCurrentEpoch () {
    return getCurrentEpoch(this)
  }

  getTotalStaked () {
    return getTotalStaked(this)
  }

  getValidatorStake (address: string) {
    return getValidatorStake(this, address)
  }
}

const defaults = {
  coinType:       118,
  bech32Prefix:   'tnam', 
  hdAccountIndex: 0,
}

export class NamadaMnemonicIdentity extends CW.MnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CW.MnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
