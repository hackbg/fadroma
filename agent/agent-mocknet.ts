import type {
  AgentClass, Uint128, AgentOpts, BundleClass, ExecOpts, Uploadable, Uploaded,
  Address, CodeHash, ChainId, CodeId, Message, Client, Label, AnyContract
} from './agent'
import { Error as BaseError, Console as BaseConsole, bold, colors, into } from './agent-base'
import { Chain, ChainMode, Agent, Bundle, assertChain } from './agent-chain'
import { Contract } from './agent-deploy'

import { randomBech32, sha256, base16, bech32 } from '@hackbg/4mat'
import { brailleDump } from '@hackbg/dump'

class MocknetConsole extends BaseConsole {
  label = 'Mocknet'
}

class MocknetError extends BaseError {
  static ContextNoAddress = this.define('ContextNoAddress',
    () => "MocknetBackend#context: Can't create contract environment without address")
  static NoInstance = this.define('NoInstance',
    () => `MocknetBackend#getInstance: can't get instance without address`)
  static NoInstanceAtAddress = this.define('NoInstanceAtAddress',
    (address: string) => `MocknetBackend#getInstance: no contract at ${address}`)
  static NoChain = this.define('NoInstance',
    () => `MocknetAgent#chain is not set`)
  static NoBackend = this.define('NoInstance',
    () => `Mocknet#backend is not set`)
}

export const Console = MocknetConsole, Error = MocknetError

/** Chain instance containing a local mocknet. */
export class Mocknet extends Chain {
  /** Agent class. */
  static Agent: AgentClass<MocknetAgent> // populated below
  /** Agent class. */
  Agent: AgentClass<MocknetAgent> = Mocknet.Agent
  /** Current block height. Increments when accessing nextBlock */
  _height = 0
  /** Native token. */
  defaultDenom = 'umock'
  /** Simulation of bank module. */
  balances: Record<Address, Uint128> = {}
  /** Increments when uploading to assign sequential code ids. */
  lastCodeId = 0
  /** Map of code hash to code id. */
  codeIdOfCodeHash: Record<CodeHash, CodeId> = {}
  /** Map of contract address to code id. */
  codeIdOfAddress: Record<Address, CodeId> = {}
  /** Map of contract address to label. */
  labelOfAddress: Record<Address, Label> = {}
  /** Map of code ID to WASM code blobs. */
  uploads: Record<CodeId, Uint8Array> = {}
  /** Map of addresses to WASM instances. */
  contracts: Record<Address, MocknetContract<'0.x'|'1.x'>> = {}

  constructor (options: Partial<Mocknet> = {}) {
    super({ id: 'mocknet', ...options, mode: ChainMode.Mocknet })
    this.log.label = 'Mocknet'
    this.uploads = options.uploads ?? this.uploads
    if (Object.keys(this.uploads).length > 0) {
      this.lastCodeId = Object.keys(this.uploads).map(x=>Number(x)).reduce((x,y)=>Math.max(x,y), 0)
    }
  }

  get isMocknet () {
    return true
  }
  get height () {
    return Promise.resolve(this._height)
  }
  get nextBlock () {
    this._height++
    return Promise.resolve(this._height)
  }

  async query <T, U> ({ address, codeHash }: Partial<Client>, msg: Message): Promise<U> {
    return this.getInstance(address).query({ msg })
  }
  async getHash (arg: Address) {
    return this.contracts[arg].codeHash as CodeHash
  }
  async getCodeId (arg: any) {
    const codeId = this.codeIdOfCodeHash[arg] ?? this.codeIdOfAddress[arg]
    if (!codeId) throw new Error(`No code id for hash ${arg}`)
    return Promise.resolve(codeId)
  }
  async getLabel (address: Address) {
    return this.labelOfAddress[address]
  }
  async getBalance (address: Address) {
    return this.balances[address] || '0'
  }

  upload (wasm: Uint8Array, meta?: any) {
    const chainId  = this.chain.id
    const codeId   = String(++this.chain.lastCodeId)
    const content  = this.chain.uploads[codeId] = wasm
    const codeHash = codeHashForBlob(wasm)
    this.chain.codeIdOfCodeHash[codeHash] = String(codeId)
    return { codeId, codeHash }
  }
  getCode (codeId: CodeId) {
    const code = this.chain.uploads[codeId]
    if (!code) throw new Error(`No code with id ${codeId}`)
    return code
  }
  async instantiate (sender: Address, instance: AnyContract): Promise<Partial<AnyContract>> {
    const label = instance.label
    const msg = await into(instance.initMsg)
    if (typeof msg === 'undefined') throw new Error('Tried to instantiate a contract with undefined initMsg')
    const address = randomBech32(MOCKNET_ADDRESS_PREFIX)
    const contract = await new MocknetContract({
      mocknet:   this,
      cwVersion: '1.x',
      codeId:    instance.codeId,
      codeHash:  instance.codeHash,
      address
    })
    await contract.load(this.getCode(instance.codeId!))
    const response = contract.init({ sender, msg })
    const {messages} = parseResult(response, 'instantiate', address)
    this.contracts[address] = contract
    this.codeIdOfAddress[address] = instance.codeId!
    this.labelOfAddress[address] = label!
    await this.passCallbacks(address, messages)
    return {
      address:  contract.address,
      chainId:  this.id,
      codeId:   instance.codeId,
      codeHash: instance.codeHash,
      label
    }
  }
  getInstance (address?: Address) {
    if (!address) throw new Error.NoInstance()
    const instance = this.contracts[address]
    if (!instance) throw new Error.NoInstanceAtAddress(address)
    return instance
  }
  async execute (
    sender: Address,
    { address, codeHash }: Partial<Client>,
    msg:   Message,
    funds: unknown,
    memo?: unknown,
    fee?:  unknown
  ) {
    const result = this.getInstance(address).execute({ sender, msg })
    const response = parseResult(result, 'execute', address)
    if (response.data !== null) response.data = b64toUtf8(response.data)
    await this.passCallbacks(address, response.messages)
    return response
  }
  async passCallbacks (sender: Address|undefined, messages: Array<any>) {
    if (!sender) {
      throw new Error("mocknet.passCallbacks: can't pass callbacks without sender")
    }
    for (const message of messages) {
      const { wasm } = message
      if (!wasm) {
        this.log.warn(
          'mocknet.execute: transaction returned non-wasm message, ignoring:',
          message
        )
        continue
      }
      const { instantiate, execute } = wasm
      if (instantiate) {
        const { code_id: codeId, callback_code_hash: codeHash, label, msg, send } = instantiate
        const instance = await this.instantiate(sender, new Contract({
          codeHash, codeId, label, initMsg: JSON.parse(b64toUtf8(msg)),
        }))
        this.log.debug(
          `Callback from ${bold(sender)}: instantiated contract`, bold(label),
          'from code id', bold(codeId), 'with hash', bold(codeHash),
          'at address', bold(instance.address!)
        )
      } else if (execute) {
        const { contract_addr, callback_code_hash, msg, send } = execute
        const response = await this.execute(
          sender,
          { address: contract_addr, codeHash: callback_code_hash },
          JSON.parse(b64toUtf8(msg)),
          send
        )
        this.log.debug(
          `Callback from ${bold(sender)}: executed transaction`,
          'on contract', bold(contract_addr), 'with hash', bold(callback_code_hash),
        )
      } else {
        this.log.warn(
          'mocknet.execute: transaction returned wasm message that was not '+
          '"instantiate" or "execute", ignoring:',
          message
        )
      }
    }
  }
}

class MocknetAgent extends Agent {
  declare chain: Mocknet
  /** The address of this agent. */
  address: Address = randomBech32(MOCKNET_ADDRESS_PREFIX)

  constructor (options: AgentOpts & { chain: Mocknet }) {
    super({ name: 'MocknetAgent', ...options||{}})
    this.chain = options.chain
    this.log.label = `${this.address} on Mocknet`
  }

  get defaultDenom (): string {
    return assertChain(this).defaultDenom
  }
  get account () {
    this.log.warn('account: stub')
    return Promise.resolve({})
  }

  /** Upload a binary to the mocknet. */
  async upload (wasm: Uint8Array, meta?: Partial<Uploadable>): Promise<Uploaded> {
    return new Contract(this.chain.upload(wasm, meta)) as unknown as Uploaded
  }
  /** Instantiate a contract on the mocknet. */
  async instantiate <C extends Client> (instance: Contract<C>) {
    instance.initMsg = await into(instance.initMsg)
    const result = await this.chain.instantiate(this.address, instance as unknown as AnyContract)
    return {
      chainId:  this.chain.id,
      address:  result.address!,
      codeHash: result.codeHash!,
      label:    result.label!,
      initBy:   this.address,
      initTx:   ''
    }
  }
  async execute <R> (
    instance: Partial<Client>,
    msg:      Message,
    opts:     ExecOpts = {}
  ): Promise<R> {
    return await this.chain.execute(this.address, instance, msg, opts.send, opts.memo, opts.fee)
  }
  async query <R> (instance: Client, msg: Message): Promise<R> {
    return await assertChain(this).query(instance, msg)
  }
  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any) {
    this.log.warn('send: stub')
    return Promise.resolve()
  }
  sendMany (_1:any, _2:any, _3?:any, _4?:any) {
    this.log.warn('sendMany: stub')
    return Promise.resolve()
  }

  /** Message bundle that warns about unsupported messages. */
  static Bundle: BundleClass<MocknetBundle>
}

class MocknetBundle extends Bundle {
  declare agent: MocknetAgent
  get log () {
    return this.agent.log.sub('(bundle)')
  }
  async submit (memo = "") {
    this.log.info('Submitting mocknet bundle...')
    const results = []
    for (const { init, exec } of this.msgs) {
      if (!!init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        results.push(await this.agent.instantiate(new Contract({
          codeId: String(codeId), initMsg: msg, codeHash, label,
        })))
      } else if (!!exec) {
        const { sender, contract: address, codeHash, msg, funds: send } = exec
        results.push(await this.agent.execute({ address, codeHash }, msg, { send }))
      } else {
        this.log.warn('MocknetBundle#submit: found unknown message in bundle, ignoring')
        results.push(null)
      }
    }
    return results
  }
  save (name: string): Promise<unknown> {
    throw new Error('MocknetBundle#save: not implemented')
  }
}

Object.assign(Mocknet, {
  Agent: Object.assign(MocknetAgent, {
    Bundle: MocknetBundle
  })
})

export {
  Mocknet       as Chain,
  MocknetAgent  as Agent,
  MocknetBundle as Bundle
}

export type CW = '0.x' | '1.x'

export class MocknetContract<V extends CW> {
  log = new Console('MocknetContract')
  mocknet?:   Mocknet
  address?:   Address
  codeHash?:  CodeHash
  codeId?:    CodeId
  cwVersion?: V
  runtime?:   WebAssembly.Instance<CWAPI<V>['exports']>
  storage = new Map<string, Buffer>()

  constructor (options: Partial<MocknetContract<V>> = {}) {
    Object.assign(this, options)
  }

  get initMethod (): Function {
    switch (this.cwVersion) {
      case '0.x': return (this.runtime!.exports as CWAPI<'0.x'>['exports']).init
      case '1.x': return (this.runtime!.exports as CWAPI<'1.x'>['exports']).instantiate
      default: throw new Error('Invalid CW API version. Supported are "0.x" and "1.x"')
    }
  }

  get execMethod (): Function {
    switch (this.cwVersion) {
      case '0.x': return (this.runtime!.exports as CWAPI<'0.x'>['exports']).handle
      case '1.x': return (this.runtime!.exports as CWAPI<'1.x'>['exports']).execute
      default: throw new Error('Invalid CW API version. Supported are "0.x" and "1.x"')
    }
  }

  get queryMethod (): Function {
    return this.runtime!.exports.query
  }

  initPtrs = ({ env, info, msg }: any = {}): Ptr[] => {
    if (typeof msg === 'undefined') throw new Error("Can't init contract with undefined init msg")
    switch (this.cwVersion) {
      case '0.x': return [this.pass(env), this.pass(msg)]
      case '1.x': return [this.pass(env), this.pass(info), this.pass(msg)]
      default: throw new Error('Invalid CW API version. Supported are "0.x" and "1.x"')
    }
  }

  execPtrs = ({ env, info, msg }: any = {}): Ptr[] => {
    if (typeof msg === 'undefined') throw new Error("Can't execute empty transaction")
    switch (this.cwVersion) {
      case '0.x': return [this.pass(env), this.pass(msg)]
      case '1.x': return [this.pass(env), this.pass(info), this.pass(msg)]
      default: throw new Error('Invalid CW API version. Supported are "0.x" and "1.x"')
    }
  }

  queryPtrs = ({ env, msg }: any = {}): Ptr[] => {
    if (typeof msg === 'undefined') throw new Error("Can't perform empty query")
    switch (this.cwVersion) {
      case '0.x': return [this.pass(msg)]
      case '1.x': return [this.pass(env), this.pass(msg)]
      default: throw new Error('Invalid CW API version. Supported are "0.x" and "1.x"')
    }
  }

  init = ({ sender, env, info, msg }: Partial<{
    sender: Address
    env:    object
    info:   object
    msg:    Message
  }> = {}) => {
    if (!sender) throw new Error('no sender')
    const context = this.makeContext(sender)
    env ??= context.env
    info ??= context.info
    try {
      const init = this.initMethod
      if (!init) {
        this.log.error('WASM exports of contract:', ...Object.keys(this.runtime?.exports??{}))
        throw new Error('Missing init entrypoint in contract.')
      }
      return this.readUtf8(this.initMethod(...this.initPtrs({ env, info, msg })))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on init:`, e.message)
      this.log.error(bold('Args:'), { env, info, msg })
      throw e
    }
  }

  execute = ({ sender, env, info, msg }: {
    sender: Address
    env?:   object
    info?:  object
    msg:    Message
  }) => {
    const context = this.makeContext(sender)
    env ??= context.env
    info ??= context.info
    this.log.log(bold(this.address), `handle: ${JSON.stringify(msg)}`)
    try {
      return this.readUtf8(this.execMethod(...this.execPtrs({ env, info, msg })))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on handle:`, e.message)
      this.log.error(bold('Args:'), { env, info, msg })
      throw e
    }
  }

  query = ({ env, msg }: {
    msg:  Message
    env?: object
  }) => {
    const context = this.makeContext('query')
    env ??= context.env
    this.log.log(bold(this.address), `query: ${JSON.stringify(msg)}`)
    try {
      const result = this.readUtf8(this.queryMethod(...this.queryPtrs({ env, msg })))
      const parsed = JSON.parse(b64toUtf8(parseResult(result, 'query', this.address)))
      return parsed
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on query:`, e.message)
      throw e
    }
  }

  load = async <W extends CW> (code: unknown /** Buffer */): Promise<MocknetContract<W> & {
    runtime:  WebAssembly.Instance<CWAPI<V>['exports']>,
    codeHash: CodeHash
  }> => {
    const {imports, refresh} = this.makeImports()
    const {instance: runtime} = await WebAssembly.instantiate(code, imports)
    const {exports} = runtime
    let cwVersion: CW
    switch (true) {
      case !!(exports as CWAPI<'1.x'>['exports']).instantiate:
        this.log.debug(`Loaded CosmWasm 1.x contract`)
        cwVersion = '1.x';
        break
      case !!(exports as CWAPI<'0.x'>['exports']).init:
        this.log.debug(`Loaded CosmWasm 0.x contract`)
        cwVersion = '0.x';
        break
      default:
        throw Object.assign(new Error('Tried to load invalid binary'), { exports })
    }
    const codeHash = codeHashForBlob(code as Buffer)
    return Object.assign(this, { runtime, cwVersion, codeHash }) as unknown as MocknetContract<W>&{
      runtime:  WebAssembly.Instance<CWAPI<V>['exports']>,
      codeHash: CodeHash
    }
  }

  makeImports = (): { imports: CWAPI<V>['imports'], refresh: Function } => {
    const {log, runtime, storage, address, mocknet} = this
    // initial memory
    const memory = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    // when reentering, get the latest memory
    const refresh = () => {
      if (!this.runtime) throw new Error('WASM instance missing')
      const {memory, allocate} = this.runtime.exports
      return {memory, allocate}
    }
    let imports = {
      memory,
      env: {
        db_read (keyPtr: Ptr) {
          const exports = refresh()
          const key = readUtf8(exports, keyPtr)
          const val = storage.get(key)
          log.debug(bold(address), `db_read: ${bold(key)}`, val ? brailleDump(val) : null)
          if (storage.has(key)) {
            return passBuffer(exports, val!)
          } else {
            return 0
          }
        },
        db_write (keyPtr: Ptr, valPtr: Ptr) {
          const exports = refresh()
          const key = readUtf8(exports, keyPtr)
          const val = readBuffer(exports, valPtr)
          storage.set(key, val)
          log.debug(bold(address), `db_write: ${bold(key)}`, brailleDump(val))
        },
        db_remove (keyPtr: Ptr) {
          const exports = refresh()
          const key = readUtf8(exports, keyPtr)
          log.debug(bold(address), `db_remove:`, bold(key))
          storage.delete(key)
        },
        query_chain (reqPtr: Ptr) {
          const exports  = refresh()
          const req      = readUtf8(exports, reqPtr)
          log.debug(bold(address), 'query_chain:', req)
          const { wasm } = JSON.parse(req)
          if (!wasm) throw new Error(
            `MocknetContract ${address} made a non-wasm query:`+
            ` ${JSON.stringify(req)}`
          )
          const { smart } = wasm
          if (!wasm) throw new Error(
            `MocknetContract ${address} made a non-smart wasm query:`+
            ` ${JSON.stringify(req)}`
          )
          if (!mocknet) throw new Error(
            `MocknetContract ${address} made a query while isolated from`+
            ` the MocknetBackend: ${JSON.stringify(req)}`
          )
          const { contract_addr, callback_code_hash, msg } = smart
          const queried = mocknet.getInstance(contract_addr)
          if (!queried) throw new Error(
            `MocknetContract ${address} made a query to contract ${contract_addr}` +
            ` which was not found in the MocknetBackend: ${JSON.stringify(req)}`
          )
          const decoded = JSON.parse(b64toUtf8(msg))
          log.debug(`${bold(address)} queries ${contract_addr}:`, decoded)
          const result = parseResult(queried.query({ msg: decoded }), 'query_chain', contract_addr)
          log.debug(`${bold(contract_addr)} responds to ${address}:`, b64toUtf8(result))
          return pass(exports, { Ok: { Ok: result } })
          // https://docs.rs/secret-cosmwasm-std/latest/secret_cosmwasm_std/type.QuerierResult.html
        }
      }
    }
    if (this.cwVersion === '0.x') {
      imports = {
        ...imports,
        env: {
          ...imports.env,
          canonicalize_address (srcPtr: Ptr, dstPtr: Ptr) {
            const exports = refresh()
            const human   = readUtf8(exports, srcPtr)
            const canon   = bech32.fromWords(bech32.decode(human).words)
            const dst     = region(exports.memory.buffer, dstPtr)
            log.debug(bold(address), `canonize:`, human, '->', `${canon}`)
            writeToRegion(exports, dstPtr, canon)
            return 0
          },
          humanize_address (srcPtr: Ptr, dstPtr: Ptr) {
            const exports = refresh()
            const canon   = readBuffer(exports, srcPtr)
            const human   = bech32.encode(MOCKNET_ADDRESS_PREFIX, bech32.toWords(canon))
            const dst     = region(exports.memory.buffer, dstPtr)
            log.debug(bold(address), `humanize:`, canon, '->', human)
            writeToRegionUtf8(exports, dstPtr, human)
            return 0
          },
        }
      } as CWAPI<'0.x'>['imports']
    } else if (this.cwVersion === '1.x') {
      imports = {
        ...imports,
        env: {
          ...imports.env,
          addr_canonicalize (srcPtr: Ptr, dstPtr: Ptr) {
            const exports = refresh()
            const human   = readUtf8(exports, srcPtr)
            const canon   = bech32.fromWords(bech32.decode(human).words)
            const dst     = region(exports.memory.buffer, dstPtr)
            log.debug(bold(address), `canonize:`, human, '->', `${canon}`)
            writeToRegion(exports, dstPtr, canon)
            return 0
          },
          addr_humanize (srcPtr: Ptr, dstPtr: Ptr) {
            const exports = refresh()
            const canon   = readBuffer(exports, srcPtr)
            const human   = bech32.encode(MOCKNET_ADDRESS_PREFIX, bech32.toWords(canon))
            const dst     = region(exports.memory.buffer, dstPtr)
            log.debug(bold(address), `humanize:`, canon, '->', human)
            writeToRegionUtf8(exports, dstPtr, human)
            return 0
          },
          addr_validate (srcPtr: Ptr) {
            log.warn('addr_validate: not implemented')
            return 0
          },
          secp256k1_recover_pubkey () {
            log.warn('sec256k1_recover_pubkey: not implemented')
            return 0
          },
          secp256k1_sign () {
            log.warn('sec256k1_sign: not implemented')
            return 0
          },
          secp256k1_verify () {
            log.warn('sec256k1_verify: not implemented')
            return 0
          },
          ed25519_batch_verify () {
            log.warn('ed25519_batch_verify: not implemented')
            return 0
          },
          ed25519_sign () {
            log.warn('ed25519_sign: not implemented')
            return 0
          },
          ed25519_verify () {
            log.warn('ed25519_verify: not implemented')
            return 0
          },
          debug (ptr: Ptr) {
            const exports = refresh()
            log.debug(bold(address), `debug:`, readUtf8(exports, ptr))
            return 0
          },
        }
      } as CWAPI<'1.x'>['imports']
    } else {
      throw new Error('Invalid CW API version. Supported are "0.x" and "1.x"')
    }
    return {
      imports: imports as CWAPI<V>['imports'],
      refresh
    }
  }

  makeContext = (sender: Address, now: number = + new Date()) => {
    if (!this.mocknet) throw new Error.NoChain()
    const chain_id = this.mocknet.id
    const height = Math.floor(now/5000)
    const time = Math.floor(now/1000)
    const sent_funds: any[] = []
    if (!this.address) throw new Error.NoAddress()
    if (!this.codeHash) throw new Error.NoCodeHash()
    const { address, codeHash } = this
    if (this.cwVersion === '0.x') {
      return {
        env: {
          block:    { height, time, chain_id },
          message:  { sender, sent_funds },
          contract: { address },
          contract_key: "",
          contract_code_hash: codeHash
        }
      }
    } else if (this.cwVersion === '1.x') {
      return {
        env: {
          block:       { height, time: String(time), chain_id },
          transaction: { index: 0 },
          contract:    { address }
        },
        info: {
          sender,
          funds: []
        }
      }
    } else {
      throw new Error('Invalid CW API version. Supported are "0.x" and "1.x"')
    }
  }

  pass = (data: any): Ptr => pass(this.runtime!.exports, data)

  readUtf8 = (ptr: Ptr) => JSON.parse(readUtf8(this.runtime!.exports, ptr))

}

export type CWAPI<V extends CW> = {
  /** CosmWasm v0 API */
  '0.x': {
    imports: {
      memory: WebAssembly.Memory
      env: {
        db_read (key: Ptr): Ptr
        db_write (key: Ptr, val: Ptr): void
        db_remove (key: Ptr): void
        query_chain (req: Ptr): Ptr
        canonicalize_address (src: Ptr, dst: Ptr): ErrCode
        humanize_address (src: Ptr, dst: Ptr): ErrCode
      }
    },
    exports: Memory & {
      init (env: Ptr, msg: Ptr): Ptr
      handle (env: Ptr, msg: Ptr): Ptr
      query (msg: Ptr): Ptr
    },
  },
  /** CosmWasm v0 API */
  '1.x': {
    imports: {
      memory: WebAssembly.Memory
      env: {
        db_read (key: Ptr): Ptr
        db_write (key: Ptr, val: Ptr): void
        db_remove (key: Ptr): void
        query_chain (req: Ptr): Ptr
        addr_canonicalize (src: Ptr, dst: Ptr): ErrCode
        addr_humanize (src: Ptr, dst: Ptr): ErrCode
        addr_validate (addr: Ptr): ErrCode
        debug (key: Ptr): Ptr
        ed25519_batch_verify (x: Ptr): Ptr
        ed25519_sign (x: Ptr, y: Ptr): Ptr
        ed25519_verify (x: Ptr, y: Ptr): Ptr
        secp256k1_recover_pubkey (x: Ptr): Ptr
        secp256k1_sign (x: Ptr, y: Ptr): Ptr
        secp256k1_verify (x: Ptr, y: Ptr): Ptr
      }
    },
    exports: Memory & {
      instantiate (env: Ptr, info: Ptr, msg: Ptr): Ptr
      execute (env: Ptr, info: Ptr, msg: Ptr): Ptr
      query (msg: Ptr): Ptr
      requires_staking (): Ptr
    }
  }
}[V]

declare namespace WebAssembly {
  class Memory {
    constructor ({ initial, maximum }: { initial: number, maximum: number })
    buffer: any
  }
  class Instance<T> {
    exports: T
  }
  function instantiate <V extends CW> (code: unknown, world: unknown): {
    instance: WebAssembly.Instance<CWAPI<V>['exports']>
  }
}

/** Error code returned by contract. */
type ErrCode = number
/** Address in WASM VM memory. */
type Ptr     = number
/** Number of bytes. */
type Size    = number
/** Memory region as allocated by CosmWasm */
type Region = [Ptr, Size, Size, Uint32Array?]
/** Heap with allocator for talking to WASM-land */
export interface Memory {
  memory: WebAssembly.Memory
  allocate (len: Size): Ptr
  deallocate? (ptr: Ptr): void
}

export const MOCKNET_ADDRESS_PREFIX = 'mocked'

export const codeHashForBlob = (blob: Uint8Array) => base16.encode(sha256(blob))

const decoder = new TextDecoder()
declare class TextDecoder { decode (data: any): string }

const encoder = new TextEncoder()
declare class TextEncoder { encode (data: string): any }

export const parseResult = (
  response: { Ok: any, Err: any },
  action:   'instantiate'|'execute'|'query'|'query_chain',
  address?: Address
): typeof Ok|typeof Err => {
  const { Ok, Err } = response
  if (Err !== undefined) {
    const errData = JSON.stringify(Err)
    const message = `Mocknet ${action}: contract ${address} returned Err: ${errData}`
    throw Object.assign(new Error(message), { Err })
  }
  if (Ok !== undefined) {
    return Ok
  }
  throw new Error(`Mocknet ${action}: contract ${address} returned non-Result type`)
}

/** Read region properties from pointer to region. */
export const region = (buffer: any, ptr: Ptr): Region => {
  const u32a = new Uint32Array(buffer)
  const addr = u32a[ptr/4+0] // Region.offset
  const size = u32a[ptr/4+1] // Region.capacity
  const used = u32a[ptr/4+2] // Region.length
  return [addr, size, used, u32a]
}
/** Read contents of region referenced by region pointer into a string. */
export const readUtf8 = (exports: Memory, ptr: Ptr): string => {
  const { buffer } = exports.memory
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const view = new DataView(buffer, addr, used)
  const data = decoder.decode(view)
  drop(exports, ptr)
  return data
}
/** Read contents of region referenced by region pointer into a string. */
export const readBuffer = (exports: Memory, ptr: Ptr): Buffer => {
  const { buffer } = exports.memory
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const output = Buffer.alloc(size)
  for (let i = addr; i < addr + size; i++) {
    output[i - addr] = u8a[i]
  }
  return output
}
/** Serialize a datum into a JSON string and pass it into the contract. */
export const pass = <T> (exports: Memory, data: T): Ptr => {
  if (typeof data === 'undefined') throw new Error('Tried to pass undefined value into contract')
  const buffer = utf8toBuffer(JSON.stringify(data))
  return passBuffer(exports, buffer)
}
/** Allocate region, write data to it, and return the pointer.
  * See: https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324 */
export const passBuffer = (exports: Memory, buf: Buffer): Ptr => {
  const ptr = exports.allocate(buf.length)
  const { buffer } = exports.memory // must be after allocation - see [1]
  const [ addr, _, __, u32a ] = region(buffer, ptr)
  u32a![ptr/4+2] = u32a![ptr/4+1] // set length to capacity
  write(buffer, addr, buf)
  return ptr
}
/** Write data to memory address. */
export const write = (buffer: any, addr: number, data: ArrayLike<number>): void =>
  new Uint8Array(buffer).set(data, addr)
/** Write UTF8-encoded data to memory address. */
export const writeUtf8 = (buffer: any, addr: number, data: string): void =>
  new Uint8Array(buffer).set(encoder.encode(data), addr)
/** Write data to address of region referenced by pointer. */
export const writeToRegion = (
  { memory: { buffer } }: Memory, ptr: Ptr, data: ArrayLike<number>
): void => {
  const [addr, size, _, u32a] = region(exports.memory.buffer, ptr)
  if (data.length > size) { // if data length > Region.capacity
    throw new Error(`Mocknet: tried to write ${data.length} bytes to region of ${size} bytes`)
  }
  const usedPtr = ptr/4+2
  u32a![usedPtr] = data.length // set Region.length
  write(exports.memory.buffer, addr, data)
}
/** Write UTF8-encoded data to address of region referenced by pointer. */
export const writeToRegionUtf8 = (exports: Memory, ptr: Ptr, data: string): void =>
  writeToRegion(exports, ptr, encoder.encode(data))
/** Deallocate memory. Fails silently if no deallocate callback is exposed by the blob. */
export const drop = ({ deallocate }: Memory, ptr: Ptr): void => deallocate && deallocate(ptr)
/** Convert base64 string to utf8 string */
export const b64toUtf8 = (str: string) => Buffer.from(str, 'base64').toString('utf8')
/** Convert utf8 string to base64 string */
export const utf8toB64 = (str: string) => Buffer.from(str, 'utf8').toString('base64')
/** Convert utf8 string to buffer. */
export const utf8toBuffer = (str: string) => Buffer.from(str, 'utf8')
/** Convert buffer to utf8 string. */
export const bufferToUtf8 = (buf: Buffer) => buf.toString('utf8')
