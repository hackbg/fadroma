/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Logged, assign, bold, into, timed } from '../Util.ts'
import type { Address, Agent, Chain, CodeId, CodeHash, Label, Message } from '../../index.ts'
import { UploadedCode } from './Upload.ts'

/** Represents a particular instance of a smart contract.
  *
  * Subclass this to add custom query and transaction methods corresponding
  * to the contract's API. */
export class Contract extends Logged {
  /** Connection to the chain on which this contract is deployed. */
  chain?:    Chain
  /** Connection to the chain on which this contract is deployed. */
  agent?:    Agent
  /** Code upload from which this contract is created. */
  codeId?:   CodeId
  /** The code hash uniquely identifies the contents of the contract code. */
  codeHash?: CodeHash
  /** The address uniquely identifies the contract instance. */
  address?:  Address
  /** The label is a human-friendly identifier of the contract. */
  label?:    Label
  /** The address of the account which instantiated the contract. */
  initBy?:   Address

  constructor (properties: Partial<Contract>) {
    super((typeof properties === 'string')?{}:properties)
    if (typeof properties === 'string') {
      properties = { address: properties }
    }
    assign(this, properties, [
      'chain',
      'agent',
      'codeId',
      'codeHash',
      'address',
      'label',
      'initBy'
    ])
  }

  /** Execute a query on the specified instance as the specified Connection. */
  query <Q> (message: Message): Promise<Q> {
    if (!this.chain) {
      throw new Error("can't query instance without connection")
    }
    if (!this.address) {
      throw new Error("can't query instance without address")
    }
    return this.chain.query<Q>(this as { address: Address }, message)
  }

  /** Execute a transaction on the specified instance as the specified Connection. */
  execute (message: Message, options: Parameters<Agent["execute"]>[2] = {}): Promise<unknown> {
    if (!this.chain) {
      throw new Error("can't transact with instance without connection")
    }
    if (!this.agent?.execute) {
      throw new Error("can't transact with instance without authorizing the connection")
    }
    if (!this.address) {
      throw new Error("can't transact with instance without address")
    }
    return this.agent?.execute(this as { address: Address }, message, options)
  }
}

export function fetchCodeInstances (
  chain: Chain, ...args: Parameters<Chain["fetchCodeInstances"]>
) {
    let $C = Contract
    let custom = false
    if (typeof args[0] === 'function') {
      $C = args.shift() as typeof Contract
      custom = true
    }
    if (!args[0]) {
      throw new Error('Invalid arguments')
    }

    if ((args[0] as any)[Symbol.iterator]) {
      const result: Record<CodeId, Record<Address, Contract>> = {}
      const codeIds: Record<CodeId, typeof $C> = {}
      for (const codeId of args[0] as unknown as CodeId[]) {
        codeIds[codeId] = $C
      }
      chain.log.debug(`Querying contracts with code ids ${Object.keys(codeIds).join(', ')}...`)
      return timed(function doFetchCodeInstances () {
        return chain.getConnection().fetchCodeInstancesImpl({ codeIds })
      }, function afterFetchCodeInstances ({elapsed}) {
        chain.log.debug(`Queried in ${elapsed}ms`)
      })
    }

    if (typeof args[0] === 'object') {
      if (custom) {
        throw new Error('Invalid arguments')
      }
      const result: Record<CodeId, Record<Address, Contract>> = {}
      chain.log.debug(`Querying contracts with code ids ${Object.keys(args[0]).join(', ')}...`)
      const codeIds = args[0] as { [id: CodeId]: typeof Contract }
      return timed(function doFetchCodeInstances () {
        return chain.getConnection().fetchCodeInstancesImpl({ codeIds })
      }, function afterFetchCodeInstances ({elapsed}) {
        chain.log.debug(`Queried in ${elapsed}ms`)
      })
    }

    if ((typeof args[0] === 'number')||(typeof args[0] === 'string')) {
      const id = args[0]
      chain.log.debug(`Querying contracts with code id ${id}...`)
      const result = {}
      return timed(function doFetchCodeInstances () {
        return chain.getConnection().fetchCodeInstancesImpl({ codeIds: { [id]: $C } })
      }, function afterFetchCodeInstances ({elapsed}) {
        chain.log.debug(`Queried in ${elapsed}ms`)
      })
    }

    throw new Error('Invalid arguments')
}

export async function fetchContractInfo (
  chain: Chain, ...args: Parameters<Chain["fetchContractInfo"]>
) {
  let $C = Contract
  let custom = false
  if (typeof args[0] === 'function') {
    $C = args.shift() as typeof Contract
    custom = true
  }
  if (!args[0]) {
    throw new Error('Invalid arguments')
  }
  const { parallel = false } = (args[1] || {}) as { parallel?: boolean }
  // Fetch single contract
  if (typeof args[0] === 'string') {
    chain.log.debug(`Fetching contract ${args[0]}`)
    const contracts = await timed(function doFetchContractInfo () {
      return chain.getConnection().fetchContractInfoImpl({
        contracts: { [args[0] as unknown as Address]: $C }
      })
    }, function afterFetchContractInfo ({ elapsed }) {
      chain.log.debug(`Fetched in ${bold(elapsed)}: contract ${args[0]}`)
    })
    if (custom) {
      return new $C(contracts[args[0]])
    } else {
      return contracts[args[0]]
    }
  }
  // Fetch array of contracts
  if ((args[0] as any)[Symbol.iterator]) {
    const addresses = args[0] as unknown as Address[]
    chain.log.debug(`Fetching ${addresses.length} contracts`)
    const contracts: Record<Address, typeof $C> = {}
    for (const address of addresses) {
      contracts[address] = $C
    }
    const results = await timed(function doFetchContractInfo () {
      return chain.getConnection().fetchContractInfoImpl({ contracts, parallel })
    }, function afterFetchContractInfo ({ elapsed }) {
      chain.log.debug(`Fetched in ${bold(elapsed)}: ${addresses.length} contracts`)
    })
    if (custom) {
      return addresses.map(address=>new $C(results[address]))
    } else {
      return addresses.map(address=>results[address])
    }
  }
  // Fetch map of contracts with different classes
  if (typeof args[0] === 'object') {
    if (custom) {
      // Can't specify class as first argument
      throw new Error('Invalid arguments')
    }
    const addresses = Object.keys(args[0]) as Address[]
    chain.log.debug(`Querying info about ${addresses.length} contracts`)
    const contracts = await timed(function doFetchcontractInfo () {
      return chain.getConnection().fetchContractInfoImpl({
        contracts: args[0] as { [address: Address]: typeof Contract },
        parallel 
      })
    }, function afterFetchContractInfo ({ elapsed }) {
      chain.log.debug(`Queried in ${bold(elapsed)}: info about ${addresses.length} contracts`)
    })
    const result: Record<Address, unknown> = {}
    for (const address of addresses) {
      result[address] = new args[0][address](contracts[address])
    }
    return result
  }
  throw new Error('Invalid arguments')
}

export function query (chain: Chain, ...args: Parameters<Chain["query"]>) {
  const [contract, message] = args
  return timed(function doQuery () {
    return chain.getConnection().queryImpl({
      ...(typeof contract === 'string') ? { address: contract } : contract,
      message
    })
  }, function afterQuery ({ elapsed, result }) {
    chain.log.debug(`Queried in ${bold(elapsed)}s: `, JSON.stringify(result))
  })
}

export async function instantiate (agent: Agent, ...args: Parameters<Agent["instantiate"]>) {
  let [contract, options] = args
  if (typeof contract === 'string') {
    contract = new UploadedCode({ codeId: contract })
  }
  if (isNaN(Number(contract.codeId))) {
    throw new Error(`can't instantiate contract with missing code id: ${contract.codeId}`)
  }
  if (!contract.codeId) {
    throw new Error("can't instantiate contract without code id")
  }
  if (!options.label) {
    throw new Error("can't instantiate contract without label")
  }
  if (!(options.initMsg||('initMsg' in options))) {
    throw new Error("can't instantiate contract without init message")
  }
  const { codeId, codeHash } = contract
  const result = await timed(function doInstantiate () {
    return into(options.initMsg).then(initMsg=>agent.getConnection().instantiateImpl({
      ...options,
      codeId,
      codeHash,
      initMsg
    }))
  }, function afterInstantiate ({ elapsed, result }) {
    agent.log.debug(
      `Instantiated in ${bold(elapsed)}:`,
      `code id ${bold(String(codeId))} as `,
      `${bold(options.label)} (${result.address})`
    )
  })
  return new Contract({
    ...options, ...result
  }) as Contract & {
    address: Address
  }
}

export async function execute (agent: Agent, ...args: Parameters<Agent["execute"]>) {
  let [contract, message, options] = args
  if (typeof contract === 'string') {
    contract = new Contract({ address: contract })
  }
  if (!contract.address) {
    throw new Error("agent.execute: no contract address")
  }
  const { address } = contract
  let method = (typeof message === 'string') ? message : Object.keys(message||{})[0]
  return timed(function doExecute () {
    return agent.getConnection().executeImpl({
      ...contract as { address: Address, codeHash: CodeHash },
      message,
      ...options
    })
  }, function afterExecute ({ elapsed }) {
    agent.log.debug(
      `Executed in ${bold(elapsed)}:`,
      `tx ${bold(method||'(???)')} of ${bold(address)}`
    )
  })
}
