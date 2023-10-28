import { Error, Console, into } from './agent-base'
import type {
  Class, Message, CodeId, Address, Name, Into, ICoin, Many, CodeHash
} from './agent-base'
import type { Agent } from './agent-chain'
import { ContractInstance } from './agent-contract'

/** A constructor for a Batch subclass. */
export interface BatchClass<B extends Batch> extends
  Class<B, ConstructorParameters<typeof Batch>>{}

type BatchAgent = Omit<Agent, 'doUpload'|'ready'> & { ready: Promise<Batch> }

/** Batch is an alternate executor that collects messages to broadcast
  * as a single transaction in order to execute them simultaneously.
  * For that, it uses the API of its parent Agent. You can use it in scripts with:
  *   await agent.batch().wrap(async batch=>{ client.as(batch).exec(...) }) */
export abstract class Batch implements BatchAgent {
  /** Messages in this batch, unencrypted. */
  msgs: any[] = []
  /** Next message id. */
  id = 0
  /** Nested batches are flattened, this counts the depth. */
  depth = 0

  constructor (
    /** The agent that will execute the batched transaction. */
    public agent: Agent,
    /** Evaluating this defines the contents of the batch. */
    public callback?: (batch: Batch)=>unknown
  ) {
    if (!agent) throw new Error.Missing.Agent('for batch')
  }

  get [Symbol.toStringTag]() { return `(${this.msgs.length}) ${this.address}` }

  log = new Console(this.constructor.name)

  get ready () { return this.agent.ready.then(()=>this) }

  get chain () { return this.agent.chain }

  get address () { return this.agent.address }

  get name () { return `${this.agent.name} (batched)` }

  get fees () { return this.agent.fees }

  get defaultDenom () { return this.agent.defaultDenom }

  get getClient () { return this.agent.getClient.bind(this) }

  /** Add a message to the batch. */
  add (msg: Message) {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  /** Either submit or save the batch. */
  async run (options: Partial<{
    memo: string,
    save: boolean
  }> = {}): Promise<unknown> {
    this.log(options.save ? 'Saving' : 'Submitting')
    if (this.depth > 0) {
      this.log.warn('Unnesting batch. Depth:', --this.depth)
      this.depth--
      return null as any // result ignored
    } else if (options.save) {
      return this.save(options.memo)
    } else {
      return this.submit(options.memo)
    }
  }

  /** Broadcast a batch to the chain. */
  async submit (memo?: string): Promise<unknown> {
    this.log.warn('Batch#submit: this function is stub; use a subclass of Batch')
    if (memo) this.log.info('Memo:', memo)
    await this.agent.ready
    if (this.callback) await Promise.resolve(this.callback(this))
    this.callback = undefined
    return this.msgs.map(()=>({}))
  }

  /** Save a batch for manual broadcast. */
  async save (name?: string): Promise<unknown> {
    this.log.warn('Batch#save: this function is stub; use a subclass of Batch')
    if (name) this.log.info('Name:', name)
    await this.agent.ready
    if (this.callback) await Promise.resolve(this.callback(this))
    this.callback = undefined
    return this.msgs.map(()=>({}))
  }

  /** Throws if the batch is invalid. */
  assertMessages (): any[] {
    if (this.msgs.length < 1) {
      this.log.emptyBatch()
      throw new Error('Batch contained no messages.')
    }
    return this.msgs
  }

  /** Add an init message to the batch.
    * @example
    *   await agent.instantiate(template.define({ label, initMsg })
    * @returns
    *   the unmodified input. */
  async instantiate (
    contract: CodeId|Partial<ContractInstance>,
    options: {
      label:      Name,
      initMsg:    Into<Message>,
      initFee?:   unknown,
      initFunds?: ICoin[],
      initMemo?:  string,
    }
  ): Promise<ContractInstance & {
    address: Address,
  }> {
    if (typeof contract === 'string') {
      contract = new ContractInstance({ codeId: contract })
    }
    this.add({ init: {
      codeId:   contract.codeId,
      codeHash: contract.codeHash,
      label:    options.label,
      msg:      await into(options.initMsg),
      sender:   this.address,
      funds:    options.initFunds || [],
      memo:     options.initMemo  || ''
    } })
    return new ContractInstance({
      chainId:  this.agent.chain!.id,
      address:  '(batch not submitted)',
      codeHash: contract.codeHash,
      label:    options.label,
      initBy:   this.address,
    }) as ContractInstance & { address: Address }
  }
  /** Add multiple init messages to the batch.
    * @example
    *   await agent.batch().wrap(async batch=>{
    *     await batch.instantiateMany(template.instances({
    *       One: { label, initMsg },
    *       Two: { label, initMsg },
    *     }))
    *     await agent.instantiateMany({
    *       One: template1.instance({ label, initMsg }),
    *       Two: template2.instance({ label, initMsg }),
    *     })
    *   })
    * @returns
    *   the unmodified inputs. */
  async instantiateMany <M extends Many<ContractInstance>> (
    contracts: M,
    options: {
      initFee?:   ICoin[]|'auto',
      initFunds?: ICoin[],
      initMemo?:  string,
    } = {}
  ): Promise<M> {
    if (!contracts) {
      throw new Error('no contracts passed to instantiateMany')
    }
    const outputs: any = (contracts instanceof Array) ? [] : {}
    await Promise.all(Object.entries(contracts).map(async ([key, contract]: [Name, ContractInstance])=>{
      if (contract.address) {
        outputs[key] = contract.address
      } else {
        outputs[key] = await this.instantiate(contract, {
          label:     contract.label!,
          initMsg:   contract.initMsg!,
          initFee:   contract.initFee   || options.initFee,
          initFunds: contract.initFunds || options.initFunds,
          initMemo:  contract.initMemo  || options.initMemo
        })
      }
    }))
    return outputs
  }
  /** Add an exec message to the batch. */
  async execute (
    contract: Address|{ address: Address, codeHash?: CodeHash },
    message:  Message,
    options:  Parameters<Agent["execute"]>[2] = {}
  ): Promise<this> {
    let address: Address
    let codeHash: CodeHash|undefined = undefined
    if (typeof contract === 'string') {
      address = contract
    } else {
      address = contract.address
      codeHash = contract.codeHash
    }
    this.add({
      exec: {
        sender:   this.address,
        contract: address,
        codeHash,
        msg:      message,
        funds:    options.execSend
      }
    })
    return this
  }
  /** Queries are disallowed in the middle of a batch because
    * even though the batch API is structured as multiple function calls,
    * the batch is ultimately submitted as a single transaction and
    * it doesn't make sense to query state in the middle of that. */
  async query <U> (
    contract: Address|{ address: Address, codeHash?: CodeHash },
    msg: Message
  ): Promise<never> {
    throw new Error.Invalid.Batching("query")
  }
  /** Uploads are disallowed in the middle of a batch because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async upload (data: unknown): Promise<never> {
    throw new Error.Invalid.Batching("upload")
  }
  async doUpload (data: unknown): Promise<never> {
    throw new Error.Invalid.Batching("upload")
  }
  /** Uploads are disallowed in the middle of a batch because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async uploadMany (uploadables: Many<unknown> = {}): Promise<never> {
    throw new Error.Invalid.Batching("upload")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  get balance (): Promise<string> {
    throw new Error.Invalid.Batching("query balance")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  get height (): Promise<number> {
    throw new Error.Invalid.Batching("query block height inside batch")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  get nextBlock (): Promise<number> {
    throw new Error.Invalid.Batching("wait for next block")
  }
  /** This doesnt change over time so it's allowed when building batches. */
  getCodeId (address: Address) {
    return this.agent.getCodeId(address)
  }
  /** This doesnt change over time so it's allowed when building batches. */
  getLabel (address: Address) {
    return this.agent.getLabel(address)
  }
  /** This doesnt change over time so it's allowed when building batches. */
  getHash (address: Address|number) {
    return this.agent.getHash(address)
  }
  /** This doesnt change over time so it's allowed when building batches. */
  checkHash (address: Address, codeHash?: CodeHash) {
    return this.agent.checkHash(address, codeHash)
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  async getBalance (denom: string): Promise<string> {
    throw new Error.Invalid.Batching("query balance")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  async send (
    recipient: Address, amounts: ICoin[], options?: Parameters<Agent["send"]>[2]
  ): Promise<void|unknown> {
    throw new Error.Invalid.Batching("send")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  async sendMany (
    outputs: [Address, ICoin[]][], options?: Parameters<Agent["sendMany"]>[1]
  ): Promise<void|unknown> {
    throw new Error.Invalid.Batching("send")
  }
  /** Nested batches are "flattened": trying to create a batch
    * from inside a batch returns the same batch. */
  batch <B extends Batch> (cb?: BatchCallback<B>): B {
    if (cb) this.log.warn('Nested batch callback ignored.')
    this.log.warn('Nest batches with care. Depth:', ++this.depth)
    return this as unknown as B
  }
  /** Batch class to use when creating a batch inside a batch.
    * @default self */
  Batch = this.constructor as { new (agent: Agent): Batch }
}

/** Function passed to Batch#wrap */
export type BatchCallback<B extends Batch> = (batch: B)=>Promise<void>
