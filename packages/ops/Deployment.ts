import {
  Console, resolve, bold, writeFileSync, relative, timestamp, backOff
} from '@hackbg/tools'

import type { Contract, InitReceipt } from './Contract'
import type { Agent } from './Agent'
import type { Chain } from './Chain'
import type { ContractMessage } from './Core'

const console = Console('@fadroma/ops/Deployment')

export type ContractConstructor<T extends Contract> =
  new (args: ContractConstructorArguments) => T

export type ContractConstructorArguments = {
  address?:  string
  codeHash?: string
  codeId?:   number
  admin?:    Agent,
  prefix?:   string
}

export type ContractInitOptions = {
  /** The on-chain address of this contract instance */
  chain?:        Chain
  address?:      string
  codeHash?:     string
  codeId?:       number

  prefix?:       string
  name?:         string
  suffix?:       string

  /** The agent that initialized this instance of the contract. */
  creator?:      Agent
  initMsg?:      any
  initTx?:       InitTX
  initReceipt?:  InitReceipt
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
  contractAddress: string
  data:            string
  logs:            Array<any>
  transactionHash: string
}

export type InitReceipt = {
  label:    string,
  codeId:   number,
  codeHash: string,
  initTx:   InitTX
}

export async function createNewDeployment ({ chain, cmdArgs = [] }) {
  const [ prefix = timestamp() ] = cmdArgs
  await chain.deployments.create(prefix)
  await chain.deployments.select(prefix)
  return needsActiveDeployment({ chain })
}

export function needsActiveDeployment ({ chain }): {
  deployment: Deployment|undefined,
  prefix:     string|undefined
} {
  const deployment = chain.deployments.active
  const prefix     = deployment?.prefix
  if (deployment) {
    console.info(bold('Active deployment:'), deployment.prefix)
    const contracts = Object.values(deployment.receipts).length
    if (contracts === 0) {
      console.info(bold('This is a clean deployment.'))
    } else {
      console.info(bold('This deployment contains'), contracts, 'contracts')
      const byCodeID = ([_, x],[__,y]) => (x.codeId > y.codeId)?1:(x.codeId < y.codeId)?-1:0
      for (
        const [name, {codeId, initTx:{contractAddress}}] of
        Object.entries(deployment.receipts).sort(byCodeID)
      ) {
        console.info(bold(String(codeId).padStart(8)), contractAddress, bold(name))
      }
    }
  }
  return {
    deployment,
    prefix
  }
}

export class Deployment {

  constructor (
    public readonly prefix: string,
    public readonly path:   string,
    public readonly receipts: Record<string, any>
  ) {}

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
    console.info(
      bold('Saving receipt for contract:'),
      contract.label,
    )
    let dir = contract.chain.deployments
    dir = dir.subdir(contract.prefix).make()// ugh hahaha so thats where the mkdir was
    const receipt = `${contract.name}${contract.suffix||''}.json` 
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
    console.info(
      bold('Looking for contract'), Contract.name,
      bold('named'),                name,
      bold('in deployment'),        this.prefix
    )
    const receipt = this.receipts[name]
    if (receipt) {
      const contract = new Contract({})
      contract.agent = agent
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
      bold('Looking for contracts of type'), Contract.name,
      bold('named like'),                    fragment,
      bold('in deployment'),                 this.prefix
    )
    const contracts = []
    for (const [name, receipt] of Object.entries(this.receipts)) {
      if (name.includes(fragment)) {
        const contract = new Contract({})
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

export class DeploymentDir extends Directory {

  KEY = '.active'

  printActive () {
    if (this.active) {
      console.log(`\nSelected deployment:`)
      console.log(`  ${bold(this.active.prefix)}`)
      for (const contract of Object.keys(this.active.contracts)) {
        console.log(`    ${colors.green('✓')}  ${contract}`)
      }
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
      bold('DeploymentDir writing:'), relative(process.cwd(), this.resolve(name))
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
  console.info(bold('Creating:'), contract.codeId, contract.label)
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
  const maxKey = Math.max(...Object.keys(obj).map(x=>x.length), 20)
  for (let [key, val] of Object.entries(obj)) {
    if (typeof val === 'object') val = JSON.stringify(val)
    val = String(val)
    if ((val as string).length > 60) val = (val as string).slice(0, 60) + '...'
    console.info(bold(`  ${key}:`.padEnd(maxKey+3)), val)
  }
}
