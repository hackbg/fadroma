import { symlinkSync, lstatSync } from 'fs'
import { resolve, basename, extname, dirname } from 'path'
import { existsSync, readFileSync, writeFileSync, readlinkSync, unlinkSync, readdirSync } from 'fs'

import { Console, bold } from '@hackbg/konzola'
import $, { JSONFile, JSONDirectory, OpaqueDirectory } from '@hackbg/kabinet'
import YAML from 'js-yaml'
import alignYAML from 'align-yaml'

import type {
  Agent,
  ClientCtor,
  ClientOpts,
  Chain,
  Instance,
  Label,
  Message,
  Template,
} from '@fadroma/client'

import { Client } from '@fadroma/client'

import { print } from './Print'

const console = Console('Fadroma Deploy')

/** The part of OperationContext that deals with deploying
  * groups of contracts and keeping track of the receipts. */
export interface DeployContext {
  template?:    Template

  templates?:   Template[]

  /** Override agent used for deploys. */
  deployAgent?: Agent

  /** Currently selected collection of interlinked contracts. */
  deployment:   Deployment

  /** Shorthand for calling `deployment.instantiate(deployAgent, ...)` */
  deploy:       (template: Template, name: string, initMsg: unknown) => Promise<Instance>

  /** Prefix to the labels of all deployed contracts.
    * Identifies which deployment they belong to. */
  prefix:       string

  /** Appended to contract labels in devnet deployments for faster iteration. */
  suffix?:      string
}

export class Deployments extends JSONDirectory<unknown> {

  static fromConfig (chain, projectRoot) {
    return $(projectRoot).in('receipts').in(chain.id).in('deployments').as(Deployments)
  }

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
    await $(dirname(path)).as(OpaqueDirectory).make()
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
      $(this.path).make()
      return []
    }
    return readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>x.endsWith('.yml'))
      .map(x=>basename(x,'.yml'))
  }

  save <D> (name: string, data: D) {
    const file = this.at(`${name}.json`).as(JSONFile) as JSONFile<D>
    console.info('Deployments writing:', bold(file.shortPath))
    return file.save(data)
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

  /** Whether a contract of this name exists in the deployment. */
  has (name: string): boolean {
    return !!this.receipts[name]
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

  getClient <C extends Client, O extends ClientOpts> (
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
      'from code id', bold(template.codeId),
      'as', name, 'with', msg
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

export class Defer<X> extends Promise<X> {
  resolve: (v: X|PromiseLike<X>) => void
  reject:  (e: Error|string)     => void
  constructor () {
    super((resolve, reject)=>{
      this.resolve = resolve
      this.reject  = reject
    })
  }
}

export class Lazy<X> extends Promise<X> {
  protected readonly resolver: ()=>X|PromiseLike<X>
  private resolved: PromiseLike<X>
  constructor (resolver?: ()=>X|PromiseLike<X>) {
    super(()=>{})
    this.resolver ??= resolver
  }
  then <Y> (resolved, rejected): Promise<Y> {
    this.resolved ??= Promise.resolve(this.resolver())
    return this.resolved.then(resolved, rejected) as Promise<Y>
  }
}

export abstract class OneShot<T> extends (function Runnable<T> () {
  let called = false
  let result: T
  return function Task (...args): T {
    if (!called) {
      called = true
      return result = this.run(...args)
    } else {
      return result
    }
  }.bind(this)
} as any) {
  run: (...args) => T
  constructor (run?: (...args) => T) {
    super()
    this.run ??= run.bind(this)
  }
}

export abstract class Slot<X> {
  abstract get (): X|null
  expect (msg: string|Error, orElse?: ()=>Promise<X>): Promise<X> {
    const val = this.get()
    if (val) {
      return Promise.resolve(val)
    } else if (orElse) {
      console.info(msg)
      return orElse()
    } else {
      if (typeof msg === 'string') msg = new Error(msg)
      throw msg
    }
  }
}

export class DeployTask<X> extends Lazy<X> {
  constructor (
    public readonly context: DeployContext,
    fn: ()=>X
  ) {
    super(fn)
    this.chain      ??= context.chain
    this.deployment ??= context.deployment
    this.creator    ??= context.deployAgent
  }
  chain:      Chain
  deployment: Deployment
  creator:    Agent
  gitRef:     string = 'HEAD'
  instance = (name: string): Instance|null => {
    return this.deployment.has(name) ? this.deployment.get(name) : null
  }
  template = (t: IntoTemplate): TemplateSlot => {
    if (typeof t === 'string') {
      if (t.indexOf('@')===-1 && this.gitRef) {
        t = `${name}@${this.gitRef}`
      }
      return new TemplateSlot(this.context, t as string)
    }
    if (t instanceof TemplateSlot && t.context === this.context) {
      return t
    }
    console.warn(t)
    throw new Error(`template: unknown argument ${t}`)
  }
  contract = <C extends Client> (
    name:    string,
    _Client: ClientCtor<C, ClientOpts> = Client as ClientCtor<C, ClientOpts>
  ): ContractSlot<C> => {
    return new ContractSlot(this, name, _Client)
  }
  deploy = async <C extends Client> (
    name:     string,
    template: IntoTemplate,
    init:     Message,
    Client?:  ClientCtor<C, ClientOpts>
  ): Promise<C> => {
    if (template instanceof Function) template = await Promise.resolve(template())
    const instance = await this.deployment.init(this.creator, template, name, init)
    const client   = new Client(this.creator, instance)
    return client as C
  }
  deployMany = async <C extends Client> (
    template: IntoTemplate,
    configs:  [string, Message][],
    Client?:  ClientCtor<C, ClientOpts>
  ): Promise<C[]> => {
    return (await this.deployment.initMany(
      this.creator,
      await this.template(template).getOrUpload(),
      configs
    )).map(instance=>this.creator.getClient(Client, instance))
  }
}

export type Into<T> = T|(()=>T)|(()=>Promise<T>)
export type IntoTemplate = string|Into<Template>|TemplateSlot

class TemplateSlot extends Slot<Template> {

  constructor (
    public readonly context: DeployContext,
    public readonly name:    string,
  ) { super() }

  get (): Template {}

  async getOrUpload (): Promise<Template> {}

  async upload (): Promise<Template> {}

}

class ContractSlot<C extends Client> extends Slot<C> {

  constructor (
    public readonly context: DeployTask<unknown>,
    public readonly name:    string,
    public readonly Client:  ClientCtor<C, ClientOpts> = Client as ClientCtor<C, ClientOpts>
  ) { super() }

  get (): C|null {
    const instance = this.context.instance(this.name)
    if (instance) {
      return new this.Client(this.context.creator, instance)
    } else {
      return null
    }
  }

  async getOrDeploy (
    template: IntoTemplate,
    init:     Message
  ): Promise<C> {
    return this.get() || await this.deploy(template, init)
  }

  async deploy (
    template: IntoTemplate,
    init:     Message
  ): Promise<C> {
    const instance = this.context.instance(this.name)
    if (instance) {
      console.error(`Name ${this.name} already corresponds to:`)
      console.trace(instance)
      throw new Error(`Already exists: ${this.name}`)
    }
    return this.context.deploy(this.name, template, init, this.Client)
  }

}

//////////////////////////////// RIP //////////////////////////////////////////////

export function Runnable<T> () {
  return function Task(...args): T {
    return this.run(...args)
  }.bind(this)
}

export class Task<T> extends (function Runnable<T> () {
  return function Task (...args): T {
    return this.run(...args)
  }.bind(this)
} as any) {
  run: (...args) => T
  constructor (run?: (...args) => T) {
    super()
    this.run ??= run.bind(this)
  }
}
