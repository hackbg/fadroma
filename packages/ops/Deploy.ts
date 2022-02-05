import {
  Console, bold, colors, timestamp, backOff,
  writeFileSync, basename, relative, resolve, dirname, cwd,
  existsSync, statSync, readFileSync,
  readlinkSync, unlinkSync,
  Directory, mkdirp, readdirSync,
} from '@hackbg/tools'

import { symlinkSync } from 'fs'

const console = Console('@fadroma/ops/Deploy')

import type { Contract, ContractConstructor } from './Contract'
import type { Agent } from './Agent'
import type { Chain } from './Chain'
import { ContractMessage, printAligned } from './Core'
import { Init, InitReceipt } from './Init'

const join = (...x:any[]) => x.map(String).join(' ')

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
  get (id: string): Deployment|null {
    const path = resolve(this.path, `${id}.yml`)
    if (!existsSync(path)) {
      return null
    }
    let prefix: string
    return new Deployment(path)
  }
  async create (id: string) {
    const path = resolve(this.path, `${id}.yml`)
    if (existsSync(path)) {
      throw new Error(`[@fadroma/ops/Deployment] ${id} already exists`)
    }
    console.info(
      bold('Creating new deployment'),
      id
    )
    await mkdirp(dirname(path))
    await writeFileSync(path, '')
  }
  // selected deployment shouldn't be implemented with symlinks...
  async select (id: string) {
    const path = resolve(this.path, `${id}.yml`)
    if (!existsSync(path)) {
      throw new Error(`[@fadroma/ops/Deployment] ${id} does not exist`)
    }
    const active = resolve(this.path, `${this.KEY}.yml`)
    try { unlinkSync(active) } catch (e) { console.warn(e.message) }
    await symlinkSync(path, active)
  }
  list () {
    if (!existsSync(this.path)) {
      console.info(`\n${this.path} does not exist, creating`)
      mkdirp.sync(this.path)
      return []
    }
    return readdirSync(this.path).filter(x=>x!=this.KEY).filter(x=>x.endsWith('.yml')).map(x=>basename(x,'.yml'))
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
      console.error(join(bold('No selected deployment on chain:'), chain.id))
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
    if (!deployment) {
      console.error(join(bold('No selected deployment on chain:'), chain.id))
      process.exit(1)
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
        if (instance === chain.deployments.KEY) {
          continue
        }
        const count = Object.keys(chain.deployments.get(instance).receipts).length
        if (chain.deployments.active && chain.deployments.active.prefix === instance) {
          instance = `${bold(instance)} (selected)`
        }
        instance = `${instance} (${count} contracts)`
        console.info(` `, instance)
      }
    }
    console.log()
    chain.deployments.printActive()
  }
}

import YAML from 'js-yaml'
import alignYAML from 'align-yaml'
export class Deployment {
  prefix:   string
  receipts: Record<string, any> = {}
  constructor (
    public readonly path: string,
  ) {
    this.load()
  }
  /** Load deployment state from YML file. */
  load (path = this.path) {
    try {
      this.prefix = basename(readlinkSync(path), '.yml')
    } catch (e) {
      this.prefix = basename(path, '.yml')
    }
    for (const receipt of YAML.loadAll(readFileSync(path, 'utf8'))) {
      const [contractName, _version] = receipt.name.split('+')
      this.receipts[contractName] = receipt
    }
  }
  /** Get existing contract or create it if it doesn't exist */
  async getOrInit <T> (
    agent:    Agent,
    contract: Contract,
    name:     string = contract.name,
    initMsg:  T      = contract.initMsg
  ) {
    const receipt = this.receipts[name]
    if (receipt) {
      contract.agent = agent
      return this.getThe(name, contract)
    } else {
      await this.init(agent, contract, initMsg)
    }
    return contract
  }
  /** Get a contract by full name match.
    * Need to provide an instance of the corresponding class
    * and then it's populated from the receipt. */
  getThe <C extends Contract> (name: string, contract: C): C {
    const receipt = this.receipts[name]
    if (receipt) {
      contract.prefix = this.prefix
      return contract.fromReceipt(receipt)
    } else {
      throw new Error(
        `@fadroma/ops: no contract ${bold(name)}` +
        ` in deployment ${bold(this.prefix)}`
      )
    }
  }
  /** Instantiate a new contract as a part of this deployment.
    * Save the contract's instantiation receipt in the instances directory for this chain.
    * If prefix is set, creates subdir grouping contracts with the same prefix. */
  async init <C extends Contract, I> (
    creator:  Agent,
    contract: C,
    initMsg:  I = contract.initMsg
  ): Promise<C> {
    const init = new Init(creator, this.prefix)
    const receipt = await init.instantiate(contract, initMsg)
    this.receipts[contract.name] = receipt
    this.save()
    return contract
  }
  /** Add arbitrary data to the deployment. */
  add (name: string, data: any) {
    this.receipts[name] = { name, ...this.receipts[name] || {}, ...data }
    this.save()
  }
  /** Write the deployment to a file. */
  save () {
    let output = ''
    for (let [name, data] of Object.entries(this.receipts)) {
      output += '---\n'
      output += alignYAML(YAML.dump({ name, ...data }, { noRefs: true }))
    }
    writeFileSync(this.path, output)
  }
  getAll <C extends Contract> (fragment: string, getContract: (string)=>C): C[] {
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
  printStatus () {
    const { receipts, prefix } = this
    const count = Object.values(receipts).length
    if (count > 0) {
      for (const name of Object.keys(receipts).sort()) {
        printReceipt(name, receipts[name])
      }
    } else {
      console.info('This deployment is empty.')
    }
  }
}

function printReceipt (name, receipt) {
  if (receipt.address) {
    console.info(
      `${receipt.address}`.padStart(45),
      bold(name.padEnd(35)),
      String(receipt.codeId||'n/a').padEnd(6),
    )
  } else {
    console.warn(
      '(non-standard receipt)'.padStart(45),
      bold(name.padEnd(35)),
      'n/a'.padEnd(6),
    )
  }
}
