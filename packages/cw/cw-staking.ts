import { Core } from '@fadroma/agent'
import type { Address } from '@fadroma/agent'
import { Amino, Proto } from '@hackbg/cosmjs-esm'
import type { CWConnection } from './cw-connection'

export async function getValidators <V extends typeof CWValidator> (
  connection: {
    tendermintClient,
    abciQuery
  },
  { pagination, details, Validator = CWValidator as V }: {
    pagination?: [number, number],
    details?:    boolean,
    Validator?:  V
  } = {}
): Promise<Array<InstanceType<V>>> {
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
  const result: Array<InstanceType<V>> = []
  for (const { address, pubkey, votingPower, proposerPriority } of validators) {
    const info = new Validator({
      address: Core.base16.encode(address),
      publicKey: pubkey.data,
      votingPower,
      proposerPriority,
    }) as InstanceType<V>
    result.push(info)
    if (details) {
      await info.fetchDetails(connection)
    }
  }
  return result
}

class CWValidator {
  address:           string
  publicKey:         string
  votingPower?:      bigint
  proposerPriority?: bigint

  constructor ({ address, publicKey, votingPower, proposerPriority }: {
    address?:          Address
    publicKey?:        string|Uint8Array|Array<number>
    votingPower?:      string|number|bigint
    proposerPriority?: string|number|bigint
  } = {}) {
    if ((publicKey instanceof Uint8Array)||(publicKey instanceof Array)) {
      publicKey = Core.base16.encode(new Uint8Array(publicKey))
    }
    this.publicKey = publicKey!
    this.address = address!
    if (votingPower) {
      this.votingPower = BigInt(votingPower)
    }
    if (proposerPriority) {
      this.proposerPriority = BigInt(proposerPriority)
    }
  }

  get publicKeyBytes () {
    return Core.base16.decode(this.publicKey)
  }
  get publicKeyHash () {
    return Core.base16.encode(Core.SHA256(this.publicKeyBytes).slice(0, 20))
  }

  async fetchDetails (connection: { abciQuery }): Promise<this> {
    const request = Proto.Cosmos.Staking.v1beta1.Query.QueryValidatorRequest.encode({
      validatorAddr: this.address
    }).finish()
    const value = await connection.abciQuery(
      '/cosmos.staking.v1beta1.Query/Validator',
      request
    )
    const decoded = Proto.Cosmos.Staking.v1beta1.Query.QueryValidatorResponse.decode(value)
    return this
  }
}

export {
  CWValidator as Validator
}
