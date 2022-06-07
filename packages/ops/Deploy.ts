import { symlinkSync, lstatSync } from 'fs'
import { relative, resolve, basename, extname, dirname } from 'path'
import { cwd } from 'process'
import { existsSync, statSync, readFileSync, writeFileSync, readlinkSync, unlinkSync, readdirSync } from 'fs'

import { Console, bold, colors } from '@hackbg/konzola'
import { timestamp, backOff } from '@hackbg/toolbox'
import { JSONDirectory, mkdirp } from '@hackbg/kabinet'
import YAML from 'js-yaml'
import alignYAML from 'align-yaml'

import type {
  Agent, 
  Chain,
  Client,
  ClientCtor,
  ClientOptions,
  Instance,
  Label,
  Message,
  Template,
} from '@fadroma/client'
import { print } from './Print'
import { config } from './Config'

const console = Console('Fadroma Deploy')

/** The part of OperationContext that deals with deploying
  * groups of contracts and keeping track of the receipts. */
export interface DeployContext {
  template?:    Template

  templates?:   Template[]

  /** Override agent used for deploys. */
  deployAgent?: Agent

  /** Currently selected collection of interlinked contracts. */
  deployment?:  Deployment

  /** Prefix to the labels of all deployed contracts.
    * Identifies which deployment they belong to. */
  prefix?:      string

  /** Appended to contract labels in devnet deployments for faster iteration. */
  suffix?:      string
}

export class Deployments extends JSONDirectory<unknown> {

  KEY = '.active'

  printActive () {
    if (this.active) {
      console.info(`Currently selected deployment:`, bold(this.active.prefix))
    } else {
      console.info(`No selected deployment.`)
    }
  }

  async create (id: string) {
    const path = resolve(this.path, `${id}.yml`)
    if (existsSync(path)) {
      throw new Error(`[@fadroma/ops/Deployment] ${id} already exists`)
    }
    console.info('Creating new deployment', bold(id))
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
    console.info('Deployments writing:', bold(relative(config.projectRoot, this.resolve(name))))
    if (data instanceof Object) {
      data = JSON.stringify(data, null, 2)
    }
    return super.save(name, data)
  }

}

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

  /** Chainable. Add to deployment, replacing existing receipts. */
  set (name: string, data = {}): this {
    this.receipts[name] = { name, ...data }
    return this.save()
  }

  /** Chainable. Add multiple to the deployment, replacing existing. */
  setMany (receipts: Record<string, any>) {
    for (const [name, receipt] of Object.entries(receipts)) {
      this.receipts[name] = receipt
    }
    return this.save()
  }

  /** Chainable. Add to deployment, merging into existing receipts. */
  add (name: string, data: any): this {
    return this.set(name, { ...this.receipts[name] || {}, ...data })
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

  getClient <C extends Client, O extends ClientOptions> (
    agent:  Agent,
    Client: ClientCtor<C, O>,
    name:   string
  ): C {
    return new Client(agent, this.get(name) as O)
  }

  /** Instantiate one contract and save its receipt to the deployment. */
  async init (
    deployAgent: Agent,
    template:    Template,
    name:        Label,
    msg:         Message
  ): Promise<Instance> {
    console.info(
      'Deploying contract', bold(name),
      'from code id', bold(template.codeId)
    )
    const label = addPrefix(this.prefix, name)
    const instance = await deployAgent.instantiate(template, label, msg)
    this.set(name, instance)
    return instance
  }

  /** Instantiate multiple contracts from the same Template with different parameters. */
  async initMany (
    deployAgent: Agent,
    template:    Template,
    configs:     [Label, Message][] = []
  ): Promise<Instance[]> {
    // this adds just the template - prefix is added in initVarious
    return this.initVarious(deployAgent, configs.map(([name, msg])=>[template, name, msg]))
  }

  /** Instantiate multiple contracts from different Templates with different parameters. */
  async initVarious (
    deployAgent: Agent,
    configs:     [Template, Label, Message][] = []
  ): Promise<Instance[]> {
    for (const [template, name] of configs) {
      console.info(
        'Deploying contract', bold(name),
        'from code id', bold(template.codeId)
      )
    }
    const receipts = await deployAgent.instantiateMany(configs.map(
      ([template, name, msg])=>[template, addPrefix(this.prefix, name), msg]
    ))
    for (const i in receipts) {
      this.set(configs[i][1], receipts[i])
    }
    return Object.values(receipts)
  }

}

export const join = (...x:any[]) => x.map(String).join(' ')

export const overrideDefaults = (obj, defaults, options = {}) => {
  for (const k of Object.keys(defaults)) {
    obj[k] = obj[k] || ((k in options) ? options[k] : defaults[k].apply(obj))
  }
}

export const addPrefix = (prefix, name) => `${prefix}/${name}`
