import { base16, SHA256, Validator } from '@hackbg/fadroma'
import type { Address } from '@hackbg/fadroma'
import { Amino, Proto } from '@hackbg/cosmjs-esm'
import type { CWChain, CWConnection } from './CWConnection'

export interface CWValidator extends Validator {
  readonly chain:             CWChain
  readonly publicKey:         string
  readonly publicKeyBytes?:   Uint8Array
  readonly publicKeyHash?:    string
  readonly votingPower?:      bigint
  readonly proposerPriority?: bigint
}

export async function fetchValidatorList (connection: CWConnection, options: {
  pagination?: [number, number],
  fetchDetails?: boolean
} = {}): Promise<Record<CWValidator["address"], CWValidator>> {
  const { pagination, fetchDetails } = options || {}
  const tendermintClient = await connection.tendermintClient!
  let response
  if (pagination && (pagination as Array<number>).length !== 0) {
    if (pagination.length !== 2) {
      throw new Error("pagination format: [page, per_page]")
    }
    response = await tendermintClient!.validators({
      page:     pagination[0],
      per_page: pagination[1],
    })
  } else {
    response = await tendermintClient!.validatorsAll()
  }
  // Sort validators by voting power in descending order.
  const validators = [...response.validators].sort((a,b)=>(
    (a.votingPower < b.votingPower) ?  1 :
    (a.votingPower > b.votingPower) ? -1 : 0
  ))
  const result: Record<CWValidator["address"], CWValidator> = {}
  for (const { address, pubkey, votingPower, proposerPriority } of validators) {
    let validator: CWValidator = {
      chain:     connection.chain,
      address:   base16.encode(address),
      publicKey: pubkey?.data,
      votingPower,
      proposerPriority,
    }
    if (fetchDetails) {
      validator = await fetchValidatorDetails(connection, validator)
    }
    result[validator.address] = validator
  }
  return result
}

export async function fetchValidatorDetails (
  connection: CWConnection,
  validator:  CWValidator
): Promise<CWValidator> {
  const request = Proto.Cosmos.Staking.v1beta1.Query.QueryValidatorRequest.encode({
    validatorAddr: validator.address
  }).finish()
  const value = await connection.abciQuery('/cosmos.staking.v1beta1.Query/Validator', request)
  const decoded = Proto.Cosmos.Staking.v1beta1.Query.QueryValidatorResponse.decode(value)
  return { ...validator, ...decoded }
}

export {
  CWValidator as Validator
}
