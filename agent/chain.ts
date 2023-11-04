/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Name, Address, Class, Into, Many, TxHash, Label, Message } from './base'
import { Error, Console, bold, into, assign } from './base'
import type { ICoin, IFee } from './token'
import type { UploadStore } from './store'
import type { CodeHash, CodeId } from './code'
import { CompiledCode, UploadedCode } from './code'
import { ContractInstance, } from './deploy'
import { ContractClient, ContractClientClass } from './client'
import type { Devnet } from './devnet'
import { assignDevnet } from './devnet'

/** A chain can be in one of the following modes: */
export enum Mode {
  Mainnet = 'mainnet',
  Testnet = 'testnet',
  Devnet  = 'devnet',
  Mocknet = 'mocknet'
}

/** The unique ID of a chain. */
export type ChainId = string

/** A constructor for an Agent subclass. */
export interface AgentClass<A extends Agent>
  extends Class<A, [ ...ConstructorParameters<typeof Agent>, ...unknown[] ]> {}

/** A connection to a chain. */
export abstract class Agent {

  /** @returns a mainnet instance of this chain. */
  static mainnet (options: Partial<Agent> = {}): Agent {
    return new (this as any)({ ...options, mode: Mode.Mainnet })
  }

  /** @returns a testnet instance of this chain. */
  static testnet (options: Partial<Agent> = {}): Agent {
    return new (this as any)({ ...options, mode: Mode.Testnet })
  }

  /** @returns a devnet instance of this chain. */
  static devnet (options: Partial<Agent> = {}): Agent {
    return new (this as any)({ ...options, mode: Mode.Devnet })
  }

  /** @returns a mocknet instance of this chain. */
  static mocknet (options?: Partial<Agent>): Agent {
    throw new Error('Mocknet is not enabled for this chain.')
  }

  /** Logger. */
  log = new Console(this.constructor.name)

  /** The API URL to use. */
  url:      string = ''

  /** An instance of the underlying implementation-specific SDK. */
  api?:     unknown

  /** Whether this is mainnet, public testnet, local devnet, or mocknet. */
  mode?:    Mode

  /** The unique id of the chain. */
  chainId?: ChainId

  /** Default fee maximums for send, upload, init, and execute. */
  fees?:    { send?: IFee, upload?: IFee, init?: IFee, exec?: IFee }

  /** If this is a devnet, this contains an interface to the devnet container. */
  devnet?:  Devnet

  /** Whether this chain is stopped. */
  stopped?: boolean

  /** The friendly name of the agent. */
  name?:    string

  /** The address from which transactions are signed and sent. */
  address?: Address

  /** The default identity used to sign transactions with this agent. */
  signer?: unknown

  constructor (properties?: Partial<Agent>) {
    assign(this, properties, [
      'url', 'mode', 'chainId', 'fees', 'devnet', 'stopped', 'name', 'address', 'api', 'signer'
    ])
    if (this.devnet) {
      assignDevnet(this, this.devnet)
      if (properties?.chainId && properties?.chainId !== properties?.devnet?.chainId) {
        this.log.warn('chain.id: ignoring override (devnet)')
      }
      if (properties?.url && properties?.url.toString() !== properties?.devnet?.url?.toString()) {
        this.log.warn('chain.url: ignoring override (devnet)')
      }
      if (properties?.mode && properties?.mode !== Mode.Devnet) {
        this.log.warn('chain.mode: ignoring override (devnet)')
      }
    } else {
      Object.defineProperties(this, {
        id: {
          enumerable: true, writable: false, value: properties?.chainId
        },
        mode: {
          enumerable: true, writable: false, value: properties?.mode || Mode.Mocknet
        }
      })
      this.url = properties?.url ?? this.url
    }

    if (this.mode === Mode.Mocknet) {
      Object.defineProperty(this, 'url', {
        enumerable: true,
        writable: false,
        value: `fadroma://mocknet-${this.chainId}`
      })
    }

    Object.defineProperties(this, {
      log: {
        configurable: true,
        enumerable: false,
        writable: true,
      },
    })

  }

  /** Compact string tag for console representation. */
  get [Symbol.toStringTag]() {
    return `${this.chainId||'(unidentified chain)'} `
         + `(${this.mode||'unspecified mode'}): `
         + `${this.name||this.address||'(unauthenticated)'}`
  }

  /** Get a client instance for talking to a specific smart contract as this executor. */
  contract <C extends ContractClient> (
    options?: Address|Partial<ContractInstance>,
    $C: ContractClientClass<C> = ContractClient as ContractClientClass<C>, 
  ): C {
    return new $C(options!, this) as C
  }

  /** Whether this is a mainnet. */
  get isMainnet () {
    return this.mode === Mode.Mainnet
  }

  /** Whether this is a testnet. */
  get isTestnet () {
    return this.mode === Mode.Testnet
  }

  /** Whether this is a devnet. */
  get isDevnet  () {
    return this.mode === Mode.Devnet
  }

  /** Whether this is a mocknet. */
  get isMocknet () {
    return this.mode === Mode.Mocknet
  }

  /** Whether this is a devnet or mocknet. */
  get devMode () {
    return this.isDevnet || this.isMocknet
  }

  /** Wait for the block height to increment. */
  get nextBlock (): Promise<number> {
    return this.height.then(async startingHeight=>{
      startingHeight = Number(startingHeight)
      if (isNaN(startingHeight)) {
        this.log.warn('Current block height undetermined. not waiting for next block')
        return Promise.resolve(NaN)
      }
      this.log(`Waiting for block > ${bold(String(startingHeight))}`)
      const t = + new Date()
      return new Promise(async (resolve, reject)=>{
        try {
          while (true && !this.stopped) {
            await new Promise(ok=>setTimeout(ok, this.blockInterval))
            this.log(
              `Waiting for block > ${bold(String(startingHeight))} ` +
              `(${((+ new Date() - t)/1000).toFixed(3)}s elapsed)`
            )
            const height = await this.height
            console.log({height})
            if (height > startingHeight) {
              this.log.info(`Block height incremented to ${bold(String(height))}, continuing`)
              return resolve(height)
            }
          }
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  blockInterval = 250

  async query <Q> (contract: Address|{ address: Address }, message: Message): Promise<Q> {
    if (typeof contract === 'string') contract = { address: contract }
    const t0 = performance.now()
    const result = this.doQuery(contract, message)
    const t1 = performance.now() - t0
    this.log.debug(
      `Queried in`,
      bold(t1.toFixed(3)),
      `msec: address`,
      bold(contract.address)
    )
    return result as Q
  }

  /** Create a new, authenticated Agent. */
  authenticate (options?: {
    name?:     Name,
    address?:  Address,
    mnemonic?: string,
    signer?:   unknown
  }): this {
    return new (this.constructor as any)({
      ...this,
      ...options
    })
  }

  /** Upload a contract's code, generating a new code id/hash pair. */
  async upload (
    code: string|URL|Uint8Array|Partial<CompiledCode>,
    options: {
      reupload?:    boolean,
      uploadStore?: UploadStore,
      uploadFee?:   ICoin[]|'auto',
      uploadMemo?:  string
    } = {},
  ): Promise<UploadedCode & { chainId: ChainId, codeId: CodeId }> {
    let template: Uint8Array
    if (code instanceof Uint8Array) {
      template = code
    } else {
      if (typeof code === 'string' || code instanceof URL) {
        code = new CompiledCode({ codePath: code })
      } else {
        code = new CompiledCode(code)
      }
      const t0 = performance.now()
      template = await (code as CompiledCode).fetch()
      const t1 = performance.now() - t0
      this.log.log(
        `Fetched in`,
        bold(t1.toFixed(3)),
        `msec:`,
        bold(String(code.codeData?.length)),
        `bytes`
      )
    }
    const t0 = performance.now()
    const result = await this.doUpload(template, options)
    const t1 = performance.now() - t0
    this.log.log(
      `Uploaded in`,
      bold(t1.toFixed(3)),
      `msec: code id`,
      bold(String(result.codeId)),
      `on chain`,
      bold(result.chainId),
      `from code hash`,
      bold(result.codeHash)
    )
    return new UploadedCode({
      ...template, ...result
    }) as UploadedCode & {
      chainId: ChainId, codeId: CodeId,
    }
  }

  /** Create a new smart contract from a code id, label and init message.
    * @example
    *   await agent.instantiate(template.define({ label, initMsg })
    * @returns
    *   ContractInstance with no `address` populated yet.
    *   This will be populated after executing the batch. */
  async instantiate (
    contract: CodeId|Partial<UploadedCode>,
    options:  Partial<ContractInstance>
  ): Promise<ContractInstance & {
    address: Address,
  }> {
    if (typeof contract === 'string') {
      contract = new UploadedCode({ codeId: contract })
    }
    if (isNaN(Number(contract.codeId))) {
      throw new Error(`can't instantiate contract with missing code id: ${contract.codeId}`)
    }
    if (!contract.codeId) {
      throw new Error("can't instantiate contract without code id")
    }
    if (!options.label) {
      throw new Error("can't instantiate contract without label")
    }
    if (!options.initMsg) {
      throw new Error("can't instantiate contract without init message")
    }
    const t0 = performance.now()
    const result = await this.doInstantiate(contract.codeId, {
      ...options,
      initMsg: await into(options.initMsg)
    })
    const t1 = performance.now() - t0
    this.log.log(
      `Instantiated in`,
      bold(t1.toFixed(3)),
      `msec:`,
      bold(String(options.label)),
      `(${bold(result.address)})`,
      `from code id`,
      bold(String(contract.codeId)),
    )
    return new ContractInstance({
      ...options, ...result
    }) as ContractInstance & {
      address: Address
    }
  }

  /** Call a transaction method on a smart contract. */
  async execute (
    contract: Address|Partial<ContractInstance>,
    message:  Message,
    options?: { execFee?: IFee, execSend?: ICoin[], execMemo?: string }
  ): Promise<unknown> {
    if (typeof contract === 'string') contract = new ContractInstance({ address: contract })
    if (!contract.address) throw new Error("agent.execute: no contract address")
    const t0 = performance.now()
    const result = await this.doExecute(contract as { address: Address }, message, options)
    const t1 = performance.now() - t0
    this.log.log(
      `Executed in`,
      bold(t1.toFixed(3)),
      `msec: address`,
      bold(contract.address)
    )
    return result
  }

  /** The default denomination of the chain's native token. */
  abstract defaultDenom:
    string

  abstract getBlockInfo ():
    Promise<unknown>

  abstract get height ():
    Promise<number>

  abstract getCodeId (contract: Address):
    Promise<CodeId>

  abstract getCodeHashOfAddress (contract: Address):
    Promise<CodeHash>

  abstract getCodeHashOfCodeId (codeId: CodeId):
    Promise<CodeHash>

  protected abstract doQuery (contract: { address: Address }, message: Message):
    Promise<unknown>

  /** Send native tokens to 1 recipient. */
  abstract send (to: Address, amounts: ICoin[], opts?: unknown):
    Promise<unknown>

  /** Send native tokens to multiple recipients. */
  abstract sendMany (outputs: [Address, ICoin[]][], opts?: unknown):
    Promise<unknown>

  protected abstract doUpload (
    data: Uint8Array, options: Parameters<typeof this["upload"]>[1]
  ): Promise<Partial<UploadedCode>>

  protected abstract doInstantiate (
    codeId: CodeId, options: Partial<ContractInstance>
  ): Promise<Partial<ContractInstance>>

  protected abstract doExecute (
    contract: { address: Address }, message: Message, options: Parameters<this["execute"]>[2]
  ): Promise<unknown>

  /** Construct a transaction batch. */
  abstract batch (): BatchBuilder<Agent>

}

export abstract class BatchBuilder<A extends Agent> {
  constructor (readonly agent: A) {}

  /** Add an upload message to the batch. */
  abstract upload (...args: Parameters<A["upload"]>):
    this

  /** Add an instantiate message to the batch. */
  abstract instantiate (...args: Parameters<A["instantiate"]>):
    this

  /** Add an execute message to the batch. */
  abstract execute (...args: Parameters<A["execute"]>):
    this

  abstract submit (...args: unknown[]): Promise<unknown>
}
