import { Core } from '@fadroma/agent'
import type { Address } from '@fadroma/agent'
import { Amino, Proto } from '@hackbg/cosmjs-esm'

type Connection = {
  log: Core.Console,
  abciQuery: (path: string, args?: Uint8Array) => Promise<Uint8Array>
  tendermintClient: Promise<{ validatorsAll }>
  bech32Prefix?: string
}

export async function getValidators <V extends typeof CWValidator> (
  connection: Connection,
  { metadata, Validator = CWValidator as V }: {
    metadata?: boolean,
    Validator?: V
  } = {}
): Promise<Array<InstanceType<V>>> {
  const tendermintClient = await connection.tendermintClient
  const validatorsResponse = await tendermintClient.validatorsAll()
  const {blockHeight, total} = validatorsResponse
  let {validators} = validatorsResponse
  // Warn on count mismatch.
  if (validators.length < total) {
    connection.log.warn(
      `Failed to fetch all validators!`,
      `Fetched ${validators.length} out of ${total}`
    )
  }
  if (validators.length > total) {
    connection.log.warn(
      `Fetched too many validators?!`,
      `Fetched ${validators.length} but total is ${total}`
    )
  }
  // Sort validators by voting power in descending order.
  validators = [...validators].sort((a,b)=>(
    (a.votingPower < b.votingPower) ?  1 :
    (a.votingPower > b.votingPower) ? -1 : 0
  ))
  const result = []
  for (let validator of validators) {
    const info = new Validator({
      address:          Core.base16.encode(validator.address),
      publicKey:        validator.pubkey.data,
      votingPower:      validator.votingPower,
      proposerPriority: validator.proposerPriority,
    })
    result.push(info)
    if (metadata) {
      await info.fetchMetadata(connection)
    }
  }
  return result
}

class CWValidator {
  address:          string
  publicKey:        string
  votingPower:      bigint
  proposerPriority: bigint

  constructor ({ address, publicKey, votingPower, proposerPriority }: {
    address?:          Address
    publicKey?:        string|Uint8Array|Array<number>
    votingPower?:      string|number|bigint
    proposerPriority?: string|number|bigint
  } = {}) {
    if ((publicKey instanceof Uint8Array)||(publicKey instanceof Array)) {
      publicKey = Core.base16.encode(new Uint8Array(publicKey))
    }
    this.publicKey = publicKey
    this.address = address
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

  async fetchMetadata (connection: Connection): Promise<this> {
    console.log(this)
    const request = Proto.Cosmos.Staking.v1beta1.Query.QueryValidatorRequest.encode({
      validatorAddr: this.address
    }).finish()
    console.log({request})
    const value = await connection.abciQuery(
      '/cosmos.staking.v1beta1.Query/Validator',
      request
    )
    console.log({value})
    const decoded = Proto.Cosmos.Staking.v1beta1.Query.QueryValidatorResponse.decode(value)
    console.log({decoded})
    return this
  }
}

export {
  CWValidator as Validator
}
