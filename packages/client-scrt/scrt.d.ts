declare module '@fadroma/client-scrt' {

  import {
    Gas, Fees,
    Chain, ChainOptions,
    Executor, Agent, AgentOptions,
    Template,
    Instance, Client, ClientCtor, ClientOptions,
  } from '@fadroma/client'

  export class ScrtGas extends Gas {

    static denom: string

    static defaultFees: Fees

    constructor (x: number)

  }

  export class ScrtChain extends Chain {
  }

  export abstract class ScrtAgent extends Agent {

    /** Default fees to use for this agent. */
    fees: typeof ScrtGas.defaultFees

    /** Default denomination for fees. */
    defaultDenomination: typeof ScrtGas.denom

    /** What TX bundle implementation to use. */
    abstract Bundle: unknown
    
    /** Create a new TX bundle. */
    bundle <T> (): T

    /** Instantiate multiple contracts from a bundled transaction. */
    instantiateMany (configs: [Template, string, object][]): Promise<Instance[]>

  }

  export interface ScrtBundleCtor <B extends ScrtBundle> {
    new (agent: ScrtAgent): B
  }

  export type ScrtBundleWrapper = (bundle: ScrtBundle) => Promise<any>

  export interface ScrtBundleResult {
    tx:        string
    type:      string
    chainId:   string
    codeId?:   string
    codeHash?: string
    address?:  string
    label?:    string
  }

  export abstract class ScrtBundle implements Executor {

    constructor (agent: Agent)

    /** The Agent that will submit the bundle. */
    readonly agent: Agent

    /** Nesting depth. Careful! */
    private depth: number

    /** Opening a bundle from within a bundle
      * returns the same bundle with incremented depth. */
    bundle (): this

    /** Populate and execute bundle */
    wrap (cb: ScrtBundleWrapper, memo?: string): Promise<ScrtBundleResult[]|null>

    /** Execute the bundle if not nested;
      * decrement the depth if nested. */
    run (memo: string): Promise<ScrtBundleResult[]|null>

    /** Index of bundle. */
    protected id: number

    /** Messages contained in bundle. */
    protected msgs: Array<any>

    /** Add a message to the bundle, incrementing
      * the bundle's internal message counter. */
    protected add (msg: any): number

    /** Get an instance of a Client subclass that adds messages to the bundle. */
    getClient <C extends Client> (Client: ClientCtor<C>, options: ClientOptions): C

    getCodeId (address): Promise<string>

    get chain (): ScrtChain

    get name (): string

    get address (): string

    getLabel (address: string): Promise<string>

    getHash (address): Promise<string>

    get balance (): Promise<bigint>

    getBalance (denom): Promise<bigint>

    get defaultDenom (): string

    /** Queries are disallowed in the middle of a bundle because
      * even though the bundle API is structured as multiple function calls,
      * the bundle is ultimately submitted as a single transaction and
      * it doesn't make sense to query state in the middle of that. */
    query <T, U> (contract: Instance, msg: T): Promise<U>

    /** Uploads are disallowed in the middle of a bundle because
      * it's easy to go over the max request size, and
      * difficult to know what that is in advance. */
    upload (data): Promise<Template>

    /** Uploads are disallowed in the middle of a bundle because
      * it's easy to go over the max request size, and
      * difficult to know what that is in advance. */
    uploadMany (data): Promise<Template[]>

    /** Add a single MsgInstantiateContract to the bundle. */
    instantiate (template: Template, label, msg, init_funds?): Promise<Instance>

    /** Add multiple MsgInstantiateContract messages to the bundle,
      * one for each contract config. */
    instantiateMany (configs: [Template, string, object][],): Promise<Record<string, Instance>>

    init (template: Template, label, msg, funds?): Promise<this>

    // @ts-ignore
    execute (instance: Instance, msg, funds?): Promise<this>

    protected assertCanSubmit (): void

    abstract submit (memo: string): Promise<ScrtBundleResult[]>

    abstract save (name: string): Promise<void>

  }

  export function mergeAttrs (attrs: {key:string,value:string}[]): any

  export * from '@fadroma/client'

}
