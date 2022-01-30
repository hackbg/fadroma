import {
  Console, resolve, bold, writeFileSync, relative, timestamp, backOff, cwd
} from '@hackbg/tools'

import type { Contract, ContractConstructor } from './Contract'
import type { Agent } from './Agent'
import type { Chain } from './Chain'
import type { ContractMessage } from './Core'

const console = Console('@fadroma/ops/Deploy')

export type ContractInitOptions = {
  /** The chain on which this contract exists. */
  chain?:    Chain
  codeId?:   number
  codeHash?: string
  /** The on-chain address of this contract instance */
  address?:  string

  prefix?: string
  name?:   string
  suffix?: string

  /** The agent that initialized this instance of the contract. */
  creator?:     Agent
  initMsg?:     any
  initTx?:      InitTX
  initReceipt?: InitReceipt
}

export interface ContractInit extends ContractInitOptions {
  /** The final label of the contract (generated from prefix, name, and suffix,
    * because the chain expects these to be globally unique.) */ 
  readonly label: string
  /** A reference to the contract in the format that ICC callbacks expect. */
  link?:      { address: string, code_hash: string }
  query       (message: ContractMessage, agent?: Agent): any
  execute     (message: ContractMessage, memo: string, send: Array<any>, fee: any, agent?: Agent): any
}

export type InitTX = {
  txhash:          string
  contractAddress: string
  data:            string
  logs:            Array<any>
  transactionHash: string,
  gas_used:        string
}

export type InitReceipt = {
  label:    string,
  codeId:   number,
  codeHash: string,
  initTx:   InitTX
}

const byCodeID = ([_, x],[__,y]) => (x.codeId > y.codeId)?1:(x.codeId < y.codeId)?-1:0

export class Deployment {

  static async new ({ chain, cmdArgs = [] }) {
    const [ prefix = timestamp() ] = cmdArgs
    await chain.deployments.create(prefix)
    await chain.deployments.select(prefix)
    return Deployment.activate({ chain })
  }

  static activate ({ chain }): {
    deployment: Deployment|undefined,
    prefix:     string|undefined
  } {
    const deployment = chain.deployments.active
    const prefix     = deployment?.prefix
    if (!deployment) {
      const join = (...x:any[]) => x.map(String).join(' ')
      console.info(` `, chain.deployments.list())
      console.error(join(bold('No selected deployment on chain:'), chain.chainId))
      process.exit(1)
    }
    deployment.printStatus()
    return { deployment, prefix }
  }

  static status ({ deployment }) {
    deployment.printStatus()
  }

  static async select (input) {
    const chain  = input.chain   // ??
    const [ id ] = input.cmdArgs || []
    const list = chain.deployments.list()
    if (list.length < 1) {
      console.log('\nNo deployments. Create one with `deploy new`')
    }
    if (id) {
      console.info(bold(`Selecting deployment:`), id)
      await chain.deployments.select(id)
    }
    if (list.length > 0) {
      console.info(bold(`Known deployments:`))
      for (let instance of chain.deployments.list()) {
        if (instance === chain.deployments.active.prefix) instance = `${bold(instance)} (selected)`
        console.info(` `, instance)
      }
    }
    console.log()
    chain.deployments.printActive()
  }

  constructor (
    public readonly prefix: string,
    public readonly path:   string,
    public readonly receipts: Record<string, any>
  ) {}

  printStatus () {
    const { receipts, prefix } = this
    const contracts = Object.values(receipts).length
    console.info(
      bold('Active deployment:'),
      prefix,
      contracts === 0 ? `(empty)` : `(${contracts} contracts)`
    )
    if (contracts > 0) {
      for (const name of Object.keys(receipts).sort()) {
        const receipt = receipts[name]
        if (receipt.initTx) {
          console.info(
            bold(String(receipt.codeId||'n/a').padStart(12)),
            receipt.initTx.contractAddress,
            bold(name)
          )
        } else {
          if (receipt.exchange) {
            console.warn(
              bold('???'.padStart(12)),
              '(non-standard receipt)'.padStart(45),
              bold(name)
            )
          }
        }
      }
    }
  }

  private populate (contract: Contract, receipt: InitReceipt) {
    contract.prefix      = this.prefix
    contract.initReceipt = receipt
    contract.codeId      = contract.initReceipt.codeId
    contract.codeHash    = contract.initReceipt.codeHash
    contract.initTx      = contract.initReceipt.initTx
    contract.address     = contract.initTx.contractAddress
  }

  /** Instantiate a new contract as a part of this deployment.
    * Save the contract's instantiation receipt in the instances directory for this chain.
    * If prefix is set, creates subdir grouping contracts with the same prefix. */
  async createContract <T> (
    creator:  Agent,
    contract: Contract,
    initMsg:  T = contract.initMsg
  ): Promise<InitReceipt> {
    contract.creator = creator
    contract.prefix  = this.prefix
    contract.initTx  = await instantiateContract(contract, initMsg)
    this.populate(contract, {
      label:    contract.label,
      codeId:   contract.codeId,
      codeHash: contract.codeHash,
      initTx:   contract.initTx
    })
    // ugly hack to save contract.
    // TODO inherit Deployment from Directory, make it create itself
    let dir = contract.chain.deployments
    dir = dir.subdir(contract.prefix).make()// ugh hahaha so thats where the mkdir was
    const receipt = `${contract.name}${contract.suffix||''}.json` 
    console.info()
    console.info(
      bold(`${contract.initTx.gas_used}`), 'uscrt gas used.',
      'Wrote', bold(relative(cwd(), dir.resolve(receipt)))
    )
    dir.save(receipt, JSON.stringify(contract.initReceipt, null, 2))
    return contract.initReceipt
  }

  async getOrCreateContract <T> (
    agent:    Agent,
    contract: Contract,
    name:     string = contract.name,
    initMsg:  T      = contract.initMsg
  ) {
    const receipt = this.receipts[name]
    if (receipt) {
      contract.agent = agent
      this.populate(contract, receipt)
    } else {
      await this.createContract(agent, contract, initMsg)
      return contract
    }
  }

  getContract <T extends Contract> (
    agent:    Agent,
    Contract: ContractConstructor<T>,
    name:     string,
  ): T {
    console.log()
    console.info(
      bold('Get contract'),  Contract.name,
      bold('named'),         name,
      bold('in deployment'), this.prefix
    )
    const receipt = this.receipts[name]
    if (receipt) {
      const contract = new Contract({agent})
      this.populate(contract, receipt)
      return contract
    } else {
      throw new Error(
        `@fadroma/ops: no contract ${bold(name)}` +
        ` in deployment ${bold(this.prefix)}`
      )
    }
  }

  getContracts <T extends Contract> (
    agent:    Agent,
    Contract: ContractConstructor<T>,
    fragment: string,
  ): T[] {
    console.info(
      bold('Get contracts of type'), Contract.name,
      bold('named like'),            fragment,
      bold('in deployment'),         this.prefix
    )
    const contracts = []
    for (const [name, receipt] of Object.entries(this.receipts)) {
      if (name.includes(fragment)) {
        const contract = new Contract({agent})
        this.populate(contract, receipt)
        contracts.push(contract)
      }
    }
    return contracts
  }

  requireContracts (
    requirements: Record<string, ContractConstructor<any>>,
    options:      any
  ): Record<string, any> {
    const contracts = {}
    for (const [name, Class] of Object.entries(requirements)) {
      contracts[name] = new Class(options)
    }
    return contracts
  }

  resolve (...fragments: Array<string>) {
    return resolve(this.path, ...fragments)
  }

  save (data: any, ...fragments: Array<string>) {
    this.receipts[fragments.join('')] = data
    if (data instanceof Object) data = JSON.stringify(data, null, 2)
    const name = `${this.resolve(...fragments)}.json`
    writeFileSync(name, data)
    console.info(
      bold('Deployment writing:'), relative(process.cwd(), name)
    )
  }

}

import {
  colors,
  existsSync,
  basename,
  readlinkSync,
  readdirSync,
  statSync,
  readFileSync,
  unlinkSync,
  symlinkDir,
  mkdirp,
  Directory
} from '@hackbg/tools'

export class Deployments extends Directory {

  KEY = '.active'

  printActive () {
    if (this.active) {
      this.active.printStatus()
    } else {
      console.log(`\nNo selected deployment.`)
    }
  }

  get active (): Deployment|null {
    return this.get(this.KEY)
  }

  get (name: string): Deployment|null {

    const path = resolve(this.path, name)

    if (!existsSync(path)) {
      return null
    }

    let prefix: string

    try {
      prefix = basename(readlinkSync(path))
    } catch (e) {
      prefix = basename(path)
    }

    const contracts = {}

    for (const contract of readdirSync(path).sort()) {
      const [contractName, _version] = basename(contract, '.json').split('+')
      const location = resolve(path, contract)
      if (statSync(location).isFile()) {
        contracts[contractName] = JSON.parse(readFileSync(location, 'utf8'))
      }
    }

    return new Deployment(prefix, path, contracts)
  }

  async create (id: string) {
    const path = resolve(this.path, id)
    if (existsSync(path)) {
      throw new Error(`[@fadroma/ops/Deployment] ${id} already exists`)
    }
    console.info(
      bold('Creating new deployment'),
      id
    )
    await mkdirp(path)
  }

  // selected deployment shouldn't be implemented with symlinks...
  async select (id: string) {
    const path = resolve(this.path, id)
    if (!existsSync(path)) {
      throw new Error(`[@fadroma/ops/Deployment] ${id} does not exist`)
    }
    const active = resolve(this.path, this.KEY)
    if (existsSync(active)) unlinkSync(active)
    await symlinkDir(path, active)
  }

  list () {
    if (!existsSync(this.path)) {
      console.info(`\n${this.path} does not exist, creating`)
      mkdirp.sync(this.path)
      return []
    }
    return readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>statSync(resolve(this.path, x)).isDirectory())
  }

  save (name: string, data: any) {
    name = `${name}.json`
    console.info(
      bold('Deployments writing:'), relative(process.cwd(), this.resolve(name))
    )
    if (data instanceof Object) {
      data = JSON.stringify(data, null, 2)
    }
    return super.save(name, data)
  }

  /** List of contracts in human-readable from */
  table () {
    const rows = []
    rows.push([bold('  label')+'\n  address', 'code id', 'code hash\ninit tx\n'])
    if (this.exists()) {
      for (const name of this.list()) {
        const { codeId, codeHash, initTx: {contractAddress, transactionHash} } = this.load(name)
        rows.push([
          `  ${bold(name)}\n  ${contractAddress}`,
          String(codeId),
          `${codeHash}\n${transactionHash}\n`
        ])
      }
    }
    return rows
  }

}

/** Given a Contract instance with the specification of a contract,
  * perform the INIT transaction that creates that contract on the
  * specified blockchain. If the contract already has an address,
  * assume it already exists and bail. */
export async function instantiateContract (
  contract: Contract,
  initMsg:  any = contract.initMsg
): Promise<InitTX> {
  console.log()
  console.info(bold('Init:'), contract.codeId, contract.label)
  initMsg = { ...contract.initMsg || {}, ...initMsg }
  printAligned(initMsg)
  if (contract.address) {
    const msg =
      `[@fadroma/ops] This contract has already `+
     `been instantiated at ${contract.address}`
    console.error(msg)
    throw new Error(msg)
  }
  const {
    label,
    codeId,
    creator = contract.creator || contract.admin || contract.agent,
  } = contract
  if (!codeId) {
    throw new Error('[@fadroma/ops] Contract must be uploaded before instantiating (missing `codeId` property)')
  }
  return await backOff(function tryInstantiate () {
    return creator.instantiate(contract, initMsg)
  }, {
    retry (error: Error, attempt: number) {
      if (error.message.includes('500')) {
        console.warn(`Error 500, retry #${attempt}...`)
        console.error(error)
        return true
      } else {
        return false
      }
    }
  })
}

function printAligned (obj: Record<string, any>) {
  const maxKey = Math.max(...Object.keys(obj).map(x=>x.length), 15)
  for (let [key, val] of Object.entries(obj)) {
    if (typeof val === 'object') val = JSON.stringify(val)
    val = String(val)
    if ((val as string).length > 60) val = (val as string).slice(0, 60) + '...'
    console.info(bold(`  ${key}:`.padEnd(maxKey+3)), val)
  }
}
