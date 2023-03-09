import Error   from './Error'
import Console from './Console'

import type { Class } from './Fields'
import type { BundleClass, Bundle } from './Bundle'
import type { Chain } from './Chain'
import type { Address, Message, ExecOpts } from './Tx'
import type { AgentFees, ICoin, IFee } from './Fee'
import type { CodeHash } from './Code'
import type { Client, ClientClass } from './Client'
import type { Uploaded, Instantiated, AnyContract } from './Contract'
import type { Contract } from './Contract'
import type { Uploader, UploaderClass } from './Upload'
import type { Name } from './Fields'
import { assertChain } from './Chain'
import type { Many } from '@hackbg/many'

/** A constructor for an Agent subclass. */
export interface AgentClass<A extends Agent> extends Class<A, ConstructorParameters<typeof Agent>>{
  Bundle: BundleClass<Bundle> // static
}

export interface AgentOpts {
  chain:     Chain
  name?:     string
  mnemonic?: string
  address?:  Address
  fees?:     AgentFees
  [key: string]: unknown
}

/** By authenticating to a network you obtain an Agent,
  * which can perform transactions as the authenticated identity. */
export abstract class Agent {
  constructor (options: Partial<AgentOpts> = {}) {
    this.chain = options.chain ?? this.chain
    this.name  = options.name  ?? this.name
    this.fees  = options.fees  ?? this.fees
    Object.defineProperties(this, {
      'chain':   { enumerable: false, writable: true },
      'address': { enumerable: false, writable: true },
      'log':     { enumerable: false, writable: true },
      'Bundle':  { enumerable: false, writable: true }
    })
  }

  get [Symbol.toStringTag]() { return `${this.chain?.id??'-'}: ${this.address}` }

  /** Logger. */
  log = new Console('Fadroma.Agent')
  /** The chain on which this agent operates. */
  chain?:   Chain
  /** The address from which transactions are signed and sent. */
  address?: Address
  /** The friendly name of the agent. */
  name?:    string
  /** Default fee maximums for send, upload, init, and execute. */
  fees?:    AgentFees
  /** The Bundle subclass to use. */
  Bundle:   BundleClass<Bundle> = (this.constructor as AgentClass<typeof this>).Bundle
  /** The default denomination in which the agent operates. */
  get defaultDenom () {
    return assertChain(this).defaultDenom
  }
  /** Get the balance of this or another address. */
  getBalance (denom = this.defaultDenom, address = this.address): Promise<string> {
    if (!this.chain) throw new Error.NoChain()
    if (!address) throw new Error.BalanceNoAddress()
    return this.chain.getBalance(denom!, address)
  }
  /** This agent's balance in the chain's native token. */
  get balance (): Promise<string> {
    return this.getBalance()
  }
  /** The chain's current block height. */
  get height (): Promise<number> {
    return assertChain(this).height
  }
  /** Wait until the block height increments. */
  get nextBlock () {
    return assertChain(this).nextBlock
  }
  /** Get the code ID of a contract. */
  getCodeId (address: Address) {
    return assertChain(this).getCodeId(address)
  }
  /** Get the label of a contract. */
  getLabel (address: Address) {
    return assertChain(this).getLabel(address)
  }
  /** Get the code hash of a contract or template. */
  getHash (address: Address|number) {
    return assertChain(this).getHash(address)
  }
  /** Check the code hash of a contract at an address against an expected value. */
  checkHash (address: Address, codeHash?: CodeHash) {
    return assertChain(this).checkHash(address, codeHash)
  }
  /** Query a contract on the chain. */
  query <R> (contract: Client, msg: Message): Promise<R> {
    return assertChain(this).query(contract, msg)
  }
  /** Send native tokens to 1 recipient. */
  abstract send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown>
  /** Send native tokens to multiple recipients. */
  abstract sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown>
  /** Upload code, generating a new code id/hash pair. */
  abstract upload (blob: Uint8Array): Promise<Uploaded>
  /** Upload multiple pieces of code, generating multiple CodeID/CodeHash pairs.
    * @returns ContractTemplate[] */
  uploadMany (blobs: Uint8Array[] = []): Promise<Uploaded[]> {
    return Promise.all(blobs.map(blob=>this.upload(blob)))
  }
  /** Create a new smart contract from a code id, label and init message.
    * @example
    *   await agent.instantiate(template.define({ label, initMsg })
    * @returns
    *   AnyContract with no `address` populated yet.
    *   This will be populated after executing the bundle. */
  abstract instantiate <C extends Client> (instance: Contract<C>): PromiseLike<Instantiated>
  /** Create multiple smart contracts from a ContractTemplate (providing code id)
    * and a list or map of label/initmsg pairs.
    * Uses this agent's Bundle class to instantiate them in a single transaction.
    * @example
    *   await agent.instantiateMany(template.instances({
    *     One: { label, initMsg },
    *     Two: { label, initMsg },
    *   }))
    *   await agent.instantiateMany({
    *     One: template1.instance({ label, initMsg }),
    *     Two: template2.instance({ label, initMsg }),
    *   }))
    * @returns
    *   either an Array<AnyContract> or a Record<string, AnyContract>,
    *   depending on what is passed as inputs. */
  async instantiateMany <C extends Many<AnyContract>> (instances: C): Promise<C> {
    // Returns an array of TX results.
    const response = await this.bundle().wrap(async bundle=>{
      await bundle.instantiateMany(instances)
    })
    // Populate instances with resulting addresses
    for (const instance of Object.values(instances)) {
      if (instance.address) continue
      // Find result corresponding to instance
      const found = response.find(({ label })=>label===instance.label)
      if (found) {
        const { address, tx, sender } = found // FIXME: implementation dependent
        instance.define({ address, initTx: tx, initBy: sender } as any)
      } else {
        this.log.warn(`Failed to find address for ${instance.label}.`)
        continue
      }
    }
    return instances
  }
  /** Call a transaction method on a smart contract. */
  abstract execute (
    contract: Partial<Client>, msg: Message, opts?: ExecOpts
  ): Promise<void|unknown>
  /** Begin a transaction bundle. */
  bundle (): Bundle {
    //@ts-ignore
    return new this.Bundle(this)
  }
  /** Get a client instance for talking to a specific smart contract as this executor. */
  getClient <C extends Client> (
    $Client:   ClientClass<C>,
    address?:  Address,
    codeHash?: CodeHash,
    ...args:   unknown[]
  ): C {
    return new $Client(
      this, address, codeHash, undefined,
      //@ts-ignore
      ...args
    ) as C
  }
  /** Get an uploader instance which performs code uploads and optionally caches them. */
  getUploader <U extends Uploader> ($U: UploaderClass<U>, ...options: any[]): U {
    //@ts-ignore
    return new $U(this, ...options) as U
  }
  /** The default Bundle class used by this Agent. */
  static Bundle: BundleClass<Bundle> // populated below
}

/** @returns the agent of a thing
  * @throws  ExpectedAgent if missing. */
export function assertAgent <A extends Agent> (thing: { agent?: A|null } = {}): A {
  if (!thing.agent) throw new Error.ExpectedAgent(thing.constructor?.name)
  return thing.agent
}
