import { Console, bold, colors, resolve, readFileSync, JSONDirectory } from '@hackbg/toolbox'
import { toBase64 } from '@iov/encoding'
import {
  Identity, Gas, Source, Artifact, Template, Label, InitMsg, Instance, Message, getMethod
} from './Core'
import { Trace } from './Trace'
import type { Chain } from './Chain'

const console = Console('@fadroma/ops/Agent')

export type AgentConstructor = (new (Identity) => Agent) & { create: (any) => Agent }

export abstract class Agent implements Identity {

  trace = new Trace("unnamed", console)

  readonly chain:   Chain
  readonly address: string
  readonly name:    string
  fees: Record<string, any>

  type?:     string

  /** Get current block height. */
  abstract get block (): Promise<any>

  /** Wait until block height increments. */
  abstract get nextBlock (): Promise<void>

  /** Get up-to-date account info for this agent's address. */
  abstract get account (): Promise<any>

  /** Get up-to-date balance of this address in `this.defaultDenomination` */
  get balance () { return this.getBalance() }

  /** Default denomination for native token. */
  abstract readonly defaultDenomination: string

  /** Get up-to-data balance of this address in specified denomination. */
  async getBalance (denomination: string = this.defaultDenomination) {
    const account = await this.account
    const balance = account.balance || []
    const inDenom = ({denom}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return 0
    return balanceInDenom.amount
  }

  abstract send (to: any, amt: string|number, denom?: any, memo?: any, fee?: any): Promise<any>

  abstract sendMany (txs: any[], memo?: string, denom?: string, fee?: any): Promise<any>

  abstract upload (artifact: Artifact): Promise<Template>

  /** Instantiate a single contract. */
  async instantiate (
    template: Template,
    label:    string,
    msg:      any,
    funds:    any[] = []
  ): Promise<Instance> {
    if (!template) {
      throw new Error('@fadroma/ops/Agent: need a Template to instantiate')
    }
    const { chainId, codeId } = template
    if (!chainId || !codeId) {
      throw new Error('@fadroma/scrt: Template must contain chainId and codeId')
    }
    if (chainId !== this.chain.id) {
      throw new Error(`@fadroma/scrt: Template is from chain ${chainId}, we're on ${this.chain.id}`)
    }
    const traceId = await this.trace.initCall(codeId, label)
    const result  = await this.doInstantiate(template, label, msg, funds)
    this.trace.initResponse(traceId, result)
    return result
  }

  /** Instantiate multiple contracts in 1 tx via a Bundle. */
  async instantiateMany (
    configs: [Template, Label, InitMsg][],
    prefix?: string
  ): Promise<Record<string, Instance>> {
    // results by tx order
    const results = await this.bundle().wrap(
      bundle => bundle.instantiateMany(configs, prefix)
    )
    // results by contract name
    const receipts = {}
    for (const i in configs) {
      const name  = configs[i][1]
      const result = results[i]
      let label = name
      if (prefix) label = `${prefix}/${label}`
      receipts[name] = {
        name,
        label,
        chainId:         result.chainId,
        codeId:          Number(result.codeId),
        codeHash:        result.codeHash,
        address:         result.address,
        transactionHash: result.tx
      }
    }
    return receipts
  }

  protected abstract doInstantiate (
    template: { chainId: string, codeId: string }, label: string, msg: any, funds: any[]
  ): Promise<any>

  abstract getLabel  (address: string): Promise<string>
  abstract getCodeId (address: string): Promise<number>

  /** Perform a smart contract query. */
  async query (
    contract: { address: string, label: string }, msg: any
  ): Promise<any> {
    const traceId = this.trace.queryCall(contract, msg)
    const response = await this.doQuery(contract, msg)
    this.trace.queryResponse(traceId, response)
    return response
  }

  protected abstract doQuery (
    contract: { address: string }, msg: any
  ): Promise<any>

  /** Execute a regular smart contract transaction. */
  async execute (
    contract: { address: string, label: string }, msg: Message, funds: any[], memo?: any, fee?: any
  ): Promise<any> {
    const traceId = this.trace.executeCall(contract, msg, funds, memo, fee)
    const response = await this.doExecute(contract, msg, funds, memo, fee)
    this.trace.executeResponse(traceId, response)
    return response
  }

  protected abstract doExecute (
    contract: { address: string, label: string },
    msg:   Message,
    funds: any[],
    memo?: any,
    fee?:  any
  ): Promise<any>

  abstract Bundle: new(Agent)=>Bundle

  /** Start a new transaction bundle. */
  bundle () {
    if (!this.Bundle) {
      throw new Error('@fadroma/ops/agent: this agent does not support bundling transactions')
    }
    //@ts-ignore
    return new this.Bundle(this)
  }

  constructor (options?: any) {
    if (options) Object.assign(this, options)
  }

}

export type BundleWrapper = (bundle: Bundle) => Promise<any>

export abstract class Bundle {

  constructor (readonly agent: Agent) {}

  get chain   () { return this.agent.chain }

  get chainId () { return this.agent.chain.id }

  get address () { return this.agent.address }

  private depth = 0

  /** Opening a bundle from within a bundle
    * returns the same bundle with incremented depth. */
  bundle (): this {
    console.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }

  /** Execute the bundle if not nested;
    * decrement the depth if nested. */
  run (memo: string): Promise<BundleResult[]|null> {
    if (this.depth > 0) {
      console.warn('Unnesting bundle. Depth:', --this.depth)
      this.depth--
      return null
    } else {
      return this.submit(memo)
    }
  }

  async wrap (cb: BundleWrapper) {
    await cb(this)
    return this.run("")
  }

  protected id: number = 0
  protected msgs: Array<any> = []

  /** Add a message to the bundle, incrementing
    * the bundle's internal message counter. */
  protected add (msg: any): number {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  abstract upload  (artifact: Artifact): Promise<this>

  abstract init    (template: Template, label: string, msg: Message, send: any[]): Promise<this>

  abstract instantiateMany (configs: [Template, Label, InitMsg][], prefix?: string): Promise<Record<string, Instance>>

  abstract execute (instance: Instance, msg: Message): Promise<this>

  abstract submit  (memo: string): Promise<BundleResult[]>

  abstract save    (name: string): Promise<void>

}

export type BundleResult = {
  tx:        string
  type:      string
  chainId:   string
  codeId?:   string
  codeHash?: string
  address?:  string
  label?:    string
}
