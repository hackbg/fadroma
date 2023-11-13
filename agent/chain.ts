/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Name, Address, Class, Into, Many, TxHash, Label, Message, Uint128 } from './base'
import { Error, Console, bold, into, assign } from './base'
import type * as Token from './token'
import { Fee, Coin } from './token'
import type { UploadStore } from './store'
import type { CodeHash, CodeId } from './code'
import { CompiledCode, UploadedCode } from './code'
import { ContractInstance, } from './deploy'
import { ContractClient } from './client'
import type { Devnet } from './devnet'
import { bip39, bip39EN } from '@hackbg/4mat'

/** A chain can be in one of the following modes: */
export enum Mode {
  Mainnet = 'mainnet',
  Testnet = 'testnet',
  Devnet  = 'devnet',
  Mocknet = 'mocknet'
}

/** The unique ID of a chain. */
export type ChainId = string

/** A connection to a chain. */
export abstract class Agent {
  /** Denomination of the token used to pay gas fees. */
  static gasToken = ''
  /** @returns Fee in gasToken */
  static gas (amount: Uint128|number): Fee {
    return new Fee(amount, this.gasToken)
  }
  /** @returns Coin in gasToken */
  static coin (amount: Uint128|number): Coin {
    return new Coin(amount, this.gasToken)
  }
  /** Create agent from random mnemonic. */
  static random (...args: ConstructorParameters<typeof this>): InstanceType<typeof this> {
    return new (this as any)({ ...args[0], mnemonic: bip39.generateMnemonic(bip39EN) }, ...args.slice(1) as [])
  }
  /** @returns a mainnet instance of this chain. */
  static mainnet (options: Partial<Agent> = {}): Agent {
    return new (this as any)({ ...options, chainMode: Mode.Mainnet })
  }
  /** @returns a testnet instance of this chain. */
  static testnet (options: Partial<Agent> = {}): Agent {
    return new (this as any)({ ...options, chainMode: Mode.Testnet })
  }
  /** @returns a devnet instance of this chain. */
  static devnet (options: Partial<Agent> = {}): Agent {
    return new (this as any)({ ...options, chainMode: Mode.Devnet })
  }
  /** @returns a mocknet instance of this chain. */
  static mocknet (options?: Partial<Agent>): Agent {
    throw new Error('Mocknet is not enabled for this chain.')
  }

  /** Logger. */
  log = new Console('Agent')

  /** The friendly name of the agent. */
  name?:         string
  /** The address from which transactions are signed and sent. */
  address?:      Address

  /** The unique id of the chain. */
  chainId?:      ChainId
  /** Whether this is mainnet, public testnet, local devnet, or mocknet. */
  chainMode?:    Mode
  /** The API URL to use. */
  chainUrl?:     string
  /** An instance of the underlying implementation-specific SDK. */
  chainApi?:     unknown
  /** Whether this chain is stopped. */
  chainStopped?: boolean
  /** Default fee maximums for send, upload, init, and execute. */
  defaultFees?: { send?: Token.IFee, upload?: Token.IFee, init?: Token.IFee, exec?: Token.IFee }

  devnet?:  Devnet<typeof Agent>|undefined

  constructor (properties?: Partial<Agent> & { mnemonic?: string }) {
    assign(this, properties, [
      'log', 'name', 'address',
      'chainUrl', 'chainMode', 'chainApi', 'chainId', 'chainStopped',
    ])
    this.defaultFees = { ...this.defaultFees||{}, ...properties?.defaultFees||{} }
    this.log.label = this[Symbol.toStringTag]
  }
  /** Compact string tag for console representation. */
  get [Symbol.toStringTag]() {
    return [
      `${this.chainId||'(unidentified chain)'}`,
      (this.chainMode ? ` (${this.chainMode})` : ''),
      ` ${this.name?`"${this.name}"`:(this.address||'(unauthenticated)')}`
    ].join('')
  }
  /** Get a client handle for a specific smart contract, authenticated as as this agent. */
  contract (options?: Address|Partial<ContractInstance>): ContractClient
  contract <C extends typeof ContractClient> (
    options?: Address|Partial<ContractInstance>, $C: C = ContractClient as C, 
  ): InstanceType<C> {
    return new $C(options!, this) as InstanceType<C>
  }
  /** Whether this is a mainnet. */
  get isMainnet () {
    return this.chainMode === Mode.Mainnet
  }
  /** Whether this is a testnet. */
  get isTestnet () {
    return this.chainMode === Mode.Testnet
  }
  /** Whether this is a devnet. */
  get isDevnet () {
    return this.chainMode === Mode.Devnet
  }
  /** Whether this is a mocknet. */
  get isMocknet () {
    return this.chainMode === Mode.Mocknet
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
        this.log.warn('Current block height undetermined. Not waiting for next block')
        return Promise.resolve(NaN)
      }
      this.log.log(
        `Waiting for block > ${bold(String(startingHeight))}`,
        `(polling every ${this.blockInterval}ms)`
      )
      const t = + new Date()
      return new Promise(async (resolve, reject)=>{
        try {
          while (true && !this.chainStopped) {
            if (this.chainStopped) {
              throw new Error('chain stopped, aborting wait for next block.')
            }
            await new Promise(ok=>setTimeout(ok, this.blockInterval))
            this.log(
              `Waiting for block > ${bold(String(startingHeight))} ` +
              `(${((+ new Date() - t)/1000).toFixed(3)}s elapsed)`
            )
            const height = await this.height
            console.log({height})
            if (height > startingHeight) {
              this.log.log(`Block height incremented to ${bold(String(height))}, proceeding`)
              return resolve(height as number)
            }
          }
        } catch (e) {
          reject(e)
        }
      })
    })
  }
  /** Time to ping for next block. */
  blockInterval = 250
  /** Query a contract. */
  async query <Q> (contract: Address|{ address: Address }, message: Message): Promise<Q> {
    if (typeof contract === 'string') contract = { address: contract }
    const t0 = performance.now()
    const result = this.doQuery(contract, message)
    const t1 = performance.now() - t0
    this.log.debug(
      `Queried in`, `${bold((t1/1000).toFixed(6))}s:`,
      bold(contract.address)
    )
    return result as Q
  }

  get balance () {
    if (!this.address) {
      throw new Error('not authenticated, use .getBalance(token, address)')
    } else if (!(this.constructor as { gasToken?: string }).gasToken) {
      throw new Error('no default token for this chain, use .getBalance(token, address)')
    } else {
      return this.getBalance('uknow', this.address)
    }
  }

  /** Send native tokens to 1 recipient. */
  async send (
    recipient: Address|{ address?: Address },
    amounts: Token.ICoin[],
    options?: { sendFee?: Token.IFee, sendMemo?: string }
  ): Promise<unknown> {
    if (typeof recipient === 'object') {
      recipient = recipient.address!
    }
    if (!recipient) {
      throw new Error('no recipient address')
    }
    const t0 = performance.now()
    const result = await this.doSend(recipient, amounts, options)
    const t1 = performance.now() - t0
    return result
  }
  /** Upload a contract's code, generating a new code id/hash pair. */
  async upload (
    code: string|URL|Uint8Array|Partial<CompiledCode>,
    options: {
      reupload?:    boolean,
      uploadStore?: UploadStore,
      uploadFee?:   Token.ICoin[]|'auto',
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
        `Fetched in`, `${bold((t1/1000).toFixed(6))}s:`,
        bold(String(code.codeData?.length)), `bytes`
      )
    }
    const t0 = performance.now()
    const result = await this.doUpload(template, options)
    const t1 = performance.now() - t0
    this.log.log(
      `Uploaded in`, `${bold((t1/1000).toFixed(6))}s:`,
      `code id`, bold(String(result.codeId)), `(${bold(result.codeHash)})`,
    )
    return new UploadedCode({
      ...template, ...result
    }) as UploadedCode & {
      chainId: ChainId, codeId: CodeId,
    }
  }
  /** Instantiate a new program from a code id, label and init message.
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
    if (!(options.initMsg||('initMsg' in options))) {
      throw new Error("can't instantiate contract without init message")
    }
    const t0 = performance.now()
    const result = await this.doInstantiate(contract.codeId, {
      ...options,
      initMsg: await into(options.initMsg)
    })
    const t1 = performance.now() - t0
    this.log.log(
      `Instantiated in`, `${bold((t1/1000).toFixed(6))}s:`,
      `from code id`, `${bold(String(contract.codeId))}:`,
      bold(String(options.label)), `(${bold(result.address)})`,
    )
    return new ContractInstance({
      ...options, ...result
    }) as ContractInstance & {
      address: Address
    }
  }

  /** Call a given program's transaction method. */
  async execute (
    contract: Address|Partial<ContractInstance>,
    message:  Message,
    options?: { execFee?: Token.IFee, execSend?: Token.ICoin[], execMemo?: string }
  ): Promise<unknown> {
    if (typeof contract === 'string') contract = new ContractInstance({ address: contract })
    if (!contract.address) throw new Error("agent.execute: no contract address")
    const t0 = performance.now()
    const result = await this.doExecute(contract as { address: Address }, message, options)
    const t1 = performance.now() - t0
    this.log.log(
      `Executed in`,
      bold((t1/1000).toFixed(8)),
      `s: address`,
      bold(contract.address)
    )
    return result
  }

  abstract get height ():
    Promise<number>
  abstract getBlockInfo ():
    Promise<unknown>
  abstract getBalance (token?: string, address?: string):
    Promise<string|number|bigint>
  abstract getCodeId (contract: Address):
    Promise<CodeId>
  abstract getCodeHashOfAddress (contract: Address):
    Promise<CodeHash>
  abstract getCodeHashOfCodeId (codeId: CodeId):
    Promise<CodeHash>
  protected abstract doQuery (contract: { address: Address }, message: Message):
    Promise<unknown>
  protected abstract doSend (
    recipient: Address,
    amounts: Token.ICoin[],
    opts?: { sendFee?: Token.IFee, sendMemo?: string }
  ): Promise<unknown>
  /** Send native tokens to multiple recipients. */
  abstract sendMany (outputs: [Address, Token.ICoin[]][], opts?: unknown):
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
