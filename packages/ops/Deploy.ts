import { symlinkSync, lstatSync } from 'fs'

import {
  Console, bold, colors, timestamp, backOff,
  relative, resolve, basename, extname, dirname, cwd,
  existsSync, statSync, readFileSync, writeFileSync,
  readlinkSync, unlinkSync,
  Directory, mkdirp, readdirSync,
} from '@hackbg/tools'
import YAML from 'js-yaml'
import alignYAML from 'align-yaml'

const console = Console('@fadroma/ops/Deploy')

import type { Contract } from './Contract'
import type { Client, ClientConstructor } from './Client'
import type { Agent } from './Agent'
import type { Chain } from './Chain'
import { Template, Instance, Message, print, join } from './Core'

export class Deployment {

  constructor (public readonly path: string) { this.load() }

  prefix:   string
  receipts: Record<string, Instance> = {}

  /** Load deployment state from YAML file. */
  load (path = this.path) {
    while (lstatSync(path).isSymbolicLink()) {
      path = resolve(dirname(path), readlinkSync(path))
    }
    this.prefix = basename(path, extname(path))
    for (const receipt of YAML.loadAll(readFileSync(path, 'utf8'))) {
      const [contractName, _version] = receipt.name.split('+')
      this.receipts[contractName] = receipt
    }
  }

  /** Write deployment state to YAML file. */
  save () {
    let output = ''
    for (let [name, data] of Object.entries(this.receipts)) {
      output += '---\n'
      output += alignYAML(YAML.dump({ name, ...data }, { noRefs: true }))
    }
    writeFileSync(this.path, output)
  }

  /** Chainable. Add arbitrary data to the deployment. */
  add (name: string, data: any): this {
    this.receipts[name] = { name, ...this.receipts[name] || {}, ...data }
    this.save()
    return this
  }

  /** Instantiate one or more contracts. */
  async instantiate (
    creator: Agent,
    ...contracts: [Contract<any>, any?, string?, string?][]
  ) {
    for (const [contract] of contracts) {
      if (contract.address) {
        throw new Error(
          `@fadroma/ops/Deploy: tried to instantiate a contract that already exists: ${contract.address}`
        )
      }
      if (!contract.codeHash) {
        throw new Error(
          `@fadroma/ops/Deploy: no code hash in: ${contract}`
        )
      }
    }
    // execute the init bundle
    const receipts = await creator.instantiateMany(contracts, this.prefix)

    // save receipts
    for (const [name, receipt] of Object.entries(receipts)) {
      this.receipts[name] = receipt
    }
    this.save()

    // return the mutated Contract instances only,
    // without the extra info for bundled init
    return contracts.map(x=>x[0])
  }

  /** Get the receipt for a contract, containing its address, codeHash, etc. */
  get (name: string, suffix?: string): Instance {
    const receipt = this.receipts[name]
    if (!receipt) {
      throw new Error(`@fadroma/ops/Deploy: ${name}: no such contract in deployment`)
    }
    return receipt
  }

  /** Get existing contract or create it if it doesn't exist */
  async getOrInit <I> (
    agent:    Agent,
    contract: Contract<any>,
    name:     string = contract.name,
    initMsg:  I      = contract.initMsg
  ) {
    console.warn('@fadroma/ops/Deploy: getOrInit: deprecated')
    const receipt = this.receipts[name]
    if (receipt) {
      contract.agent = agent
      return this.getThe(name, contract)
    } else {
      await this.instantiate(agent, [contract, initMsg])
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
        print.receipt(name, receipts[name])
      }
    } else {
      console.info('This deployment is empty.')
    }
  }
}

export class Deployments extends Directory {
  KEY = '.active'
  printActive () {
    if (this.active) {
      this.active.printStatus()
    } else {
      console.info(`\nNo selected deployment.`)
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
      console.info('\nNo deployments. Create one with `deploy new`')
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
