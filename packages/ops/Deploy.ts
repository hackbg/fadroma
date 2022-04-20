import { symlinkSync, lstatSync } from 'fs'

import {
  Console, bold, colors, timestamp, backOff,
  relative, resolve, basename, extname, dirname, cwd,
  existsSync, statSync, readFileSync, writeFileSync,
  readlinkSync, unlinkSync,
  Directory, mkdirp, readdirSync,
} from '@hackbg/toolbox'
import YAML from 'js-yaml'
import alignYAML from 'align-yaml'

const console = Console('@fadroma/ops/Deploy')

import type { Client, ClientConstructor } from './Client'
import type { Agent } from './Agent'
import type { Chain } from './Chain'
import { Template, Label, InitMsg, Instance, Message, join } from './Core'
import { print } from './Print'
import { config } from './Config'

export class Deployment {

  constructor (
    public readonly path: string,
  ) {
    this.load()
  }

  /** This is the name of the deployment.
    * It's used as a prefix to contract labels
    * (which need to be globally unique). */
  prefix: string

  /** These are the items contained by the Deployment.
    * They correspond to individual contract instances. */
  receipts: Record<string, Instance & any> = {}

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

  /** Get the receipt for a contract, containing its address, codeHash, etc. */
  get (name: string, suffix?: string): Instance {
    const receipt = this.receipts[name]
    if (!receipt) {
      const msg = `@fadroma/ops/Deploy: ${name}: no such contract in deployment`
      console.error(msg)
      print(console).deployment(this)
      throw new Error(msg)
    }
    receipt.name = name
    return receipt
  }

  /** Instantiate one contract and save its receipt to the deployment. */
  async init <T> (deployAgent: Agent, template: Template, name: Label, initMsg: T): Promise<Instance> {
    const label = `${this.prefix}/${name}`
    const instance = await deployAgent.instantiate(template, label, initMsg)
    this.set(name, instance)
    return instance
  }

  /** Chainable. Add to deployment, replacing existing receipts. */
  set (name: string, data = {}): this {
    this.receipts[name] = { name, ...data }
    return this.save()
  }

  /** Chainable. Add to deployment, merging into existing receipts. */
  add (name: string, data: any): this {
    return this.set(name, { ...this.receipts[name] || {}, ...data })
  }

  /** Instantiate multiple contracts from the same Template with different parameters. */
  async initMany (deployAgent: Agent, template: Template, configs: [Label, InitMsg][] = []): Promise<Instance[]> {
    return this.initVarious(deployAgent, configs.map(([label, initMsg])=>[template, label, initMsg]))
  }

  /** Instantiate multiple contracts from different Templates with different parameters. */
  async initVarious (deployAgent: Agent, configs: [Template, Label, InitMsg][] = []): Promise<Instance[]> {
    const receipts = await deployAgent.instantiateMany(configs, this.prefix)
    this.setMany(receipts)
    return Object.values(receipts)
  }
  /** Chainable. Add multiple to the deployment, replacing existing. */
  setMany (receipts: Record<string, any>) {
    for (const [name, receipt] of Object.entries(receipts)) {
      this.receipts[name] = receipt
    }
    return this.save()
  }

  /** Chainable: Serialize deployment state to YAML file. */
  save (): this {
    let output = ''
    for (let [name, data] of Object.entries(this.receipts)) {
      output += '---\n'
      output += alignYAML(YAML.dump({ name, ...data }, { noRefs: true }))
    }
    writeFileSync(this.path, output)
    return this
  }

  /** Resolve a path relative to the deployment directory. */
  resolve (...fragments: Array<string>) {
    return resolve(this.path, ...fragments)
  }

}

export interface DeployContext {
  deployment: Deployment|undefined,
  prefix:     string|undefined
}

export class Deployments extends Directory {

  KEY = '.active'

  printActive () {
    if (this.active) {
      print(console).deployment(this.active)
    } else {
      console.info(`\nNo selected deployment.`)
    }
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

  async select (id: string) {
    const path = resolve(this.path, `${id}.yml`)
    if (!existsSync(path)) {
      throw new Error(`[@fadroma/ops/Deployment] ${id} does not exist`)
    }
    const active = resolve(this.path, `${this.KEY}.yml`)
    try { unlinkSync(active) } catch (e) { console.warn(e.message) }
    await symlinkSync(path, active)
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

  list () {
    if (!existsSync(this.path)) {
      console.info(`\n${this.path} does not exist, creating`)
      mkdirp.sync(this.path)
      return []
    }
    return readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>x.endsWith('.yml'))
      .map(x=>basename(x,'.yml'))
  }

  save (name: string, data: any) {
    name = `${name}.json`
    console.info(
      bold('Deployments writing:'), relative(config.projectRoot, this.resolve(name))
    )
    if (data instanceof Object) {
      data = JSON.stringify(data, null, 2)
    }
    return super.save(name, data)
  }

  /** Command: Create a new deployment. */
  static new = async function createDeployment ({ chain, cmdArgs = [] }): Promise<DeployContext> {
    const [ prefix = timestamp() ] = cmdArgs
    await chain.deployments.create(prefix)
    await chain.deployments.select(prefix)
    return this.activate({ chain })
  }

  /** Command: Activate a deployment and prints its status. */
  static activate = function activateDeployment ({ chain }): DeployContext {
    const deployment = chain.deployments.active
    if (!deployment) {
      console.error(join(bold('No selected deployment on chain:'), chain.id))
      process.exit(1)
    }
    const prefix = deployment.prefix
    let contracts: string|number = Object.values(deployment.receipts).length
    contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
    console.info(bold('Active deployment:'), prefix, contracts)
    print(console).deployment(deployment)
    return { deployment, prefix }
  }

  static activateOrNew = async function activateOrCreateDeployment ({
    chain, cmdArgs
  }): Promise<DeployContext> {
    if (chain.deployments.active) {
      return this.activate({ chain })
    } else {
      return await this.new({ chain, cmdArgs })
    }
  }

  /** Command: Print the status of a deployment. */
  static status = function printStatusOfDeployment ({ chain, cmdArgs: [id] = [undefined] }) {
    let deployment = chain.deployments.active
    if (id) {
      deployment = chain.deployments.get(id)
    }
    if (!deployment) {
      console.error(join(bold('No selected deployment on chain:'), chain.id))
      process.exit(1)
    }
    print(console).deployment(deployment)
  }

  /** Command: Set a new deployment as active. */
  static select = async function selectDeployment ({ chain, cmdArgs: [id] = [undefined] }) {
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
      for (let deployment of chain.deployments.list()) {
        if (deployment === chain.deployments.KEY) {
          continue
        }
        const count = Object.keys(chain.deployments.get(deployment).receipts).length
        if (chain.deployments.active && chain.deployments.active.prefix === deployment) {
          deployment = `${bold(deployment)} (selected)`
        }
        deployment = `${deployment} (${count} contracts)`
        console.info(` `, deployment)
      }
    }
    console.log()
    chain.deployments.printActive()
  }

}
