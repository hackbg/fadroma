import {
  Console, bold, colors,
  writeFileSync, relative, resolve, timestamp, backOff, cwd,
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

const console = Console('@fadroma/ops/Deploy')

import type { Contract, ContractConstructor } from './Contract'
import type { Agent } from './Agent'
import type { Chain } from './Chain'
import { ContractMessage, printAligned } from './Core'
import { instantiateContract } from './Init'

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

  /* Command. Create a new deployment. */
  static async new ({ chain, cmdArgs = [] }) {
    const [ prefix = timestamp() ] = cmdArgs
    await chain.deployments.create(prefix)
    await chain.deployments.select(prefix)
    return Deployments.activate({ chain })
  }

  /* Command. Activate a deployment and prints its status. */
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
    let contracts: string|number = Object.values(deployment.receipts).length
    contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
    console.info(bold('Active deployment:'), prefix, contracts)
    deployment.printStatus()
    return { deployment, prefix }
  }

  /* Command. Print the status of a deployment. */
  static status ({ chain, cmdArgs: [ id ] }) {
    let deployment = chain.deployments.active
    if (id) {
      deployment = chain.deployments.get(id)
    }
    deployment.printStatus()
  }

  /* Command. Set a new deployment as active. */
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
        const contracts = Object.keys(chain.deployments.get(instance).receipts).length
        if (instance === chain.deployments.active.prefix) instance = `${bold(instance)} (selected)`
        instance = `${instance} (${contracts} contracts)`
        console.info(` `, instance)
      }
    }
    console.log()
    chain.deployments.printActive()
  }
}

export class Deployment {

  constructor (
    public readonly prefix: string,
    public readonly path:   string,
    public readonly receipts: Record<string, any>
  ) {}

  printStatus () {
    const { receipts, prefix } = this
    const contracts = Object.values(receipts).length
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
    } else {
      console.info('This deployment is empty.')
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

  getThe <T extends Contract> (name: string, contract: T): T {
    const receipt = this.receipts[name]
    if (receipt) {
      this.populate(contract, receipt)
      return contract
    } else {
      throw new Error(
        `@fadroma/ops: no contract ${bold(name)}` +
        ` in deployment ${bold(this.prefix)}`
      )
    }
  }

  getAll <T extends Contract> (fragment: string, getContract: (string)=>T) {
    const contracts = []
    for (const [name, receipt] of Object.entries(this.receipts)) {
      if (name.includes(fragment)) {
        contracts.push(this.getThe(name, getContract(name)))
      }
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
