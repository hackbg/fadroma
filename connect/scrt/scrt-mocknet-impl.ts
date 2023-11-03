import type { CodeHash, CodeId, Address } from '@fadroma/agent'
import {
  Console, bold, Error, Stub, base16, sha256, into, bech32, randomBech32,
  ContractInstance,
} from '@fadroma/agent'
import * as secp256k1 from '@noble/secp256k1'
import * as ed25519   from '@noble/ed25519'

type ScrtCWVersion = '0.x'|'1.x'

type ScrtMocknetUpload = {
  codeHash:        CodeHash
  codeData:        Uint8Array
  wasmModule:      WebAssembly.Module
  cosmWasmVersion: ScrtCWVersion
}

export class ScrtMocknetState extends Stub.ChainState {
  log = new Console('ScrtMocknetState')

  declare uploads: Map<CodeId, ScrtMocknetUpload>

  async upload (codeData: Uint8Array): Promise<ScrtMocknetUpload> {
    if (codeData.length < 1) throw new Error('Tried to upload empty binary.')
    const upload = await super.upload(codeData) as ScrtMocknetUpload
    const wasmModule  = await WebAssembly.compile(upload)
    const wasmExports = WebAssembly.Module.exports(wasmModule)
    const cosmWasmVersion = this.checkVersion(exports.map((x: { name: string })=>x.name))
    if (cosmWasmVersion === null) {
      throw new Error("failed to detect CosmWasm version from uploaded binary")
    }
    upload.wasmModule = wasmModule
    upload.cosmWasmVersion = cosmWasmVersion
    return upload
  }

  async instantiate (
    sender: Address,
    instance: Partial<ContractInstance>
  ): Promise<ContractInstance> {
    const { label, initMsg, codeId, codeHash } = instance
    if (!codeId) throw new Error('missing code id')
    // Check code hash
    const { module, cwVersion, codeHash: expectedCodeHash } = this.getCode(codeId)
    if (codeHash !== expectedCodeHash) this.log.warn('Wrong code hash passed with code id', codeId)
    // Resolve lazy init
    const msg = await into(initMsg)
    if (typeof msg === 'undefined') {
      throw new Error("can't instantiate without init message")
    }
    // Generate address and construct contract
    const address = randomBech32(MOCKNET_ADDRESS_PREFIX).slice(0,20)
    const mocknet = this
    const contract = await new MocknetContract({ mocknet, codeId, codeHash, address, cwVersion })
    // Provide imports and launch contract runtime (wasm instance)
    const {imports, refresh} = contract.makeImports()
    contract.runtime = await WebAssembly.instantiate(module, imports)
    const response = contract.init({ sender, msg })
    const {messages} = parseResult(response, 'instantiate', address)
    this.contracts[address] = contract
    this.codeIdOfAddress[address] = instance.codeId!
    this.labelOfAddress[address] = label!
    await this.passCallbacks(cwVersion, address, messages)
    return {
      chainId: this.id,
      address: contract.address,
      codeId,
      codeHash,
      label
    }
  }

  async execute (
    sender: Address,
    { address }: Partial<ContractInstance>,
    message: Message,
    options?: {
      execSend?: unknown,
      execMemo?: unknown,
      execFee?:  unknown
    }
  ) {
    const contract = this.getContract(address)
    const result   = contract.execute({ sender, msg: message })
    const response = parseResult(result, 'execute', address)
    if (response.data !== null) response.data = b64toUtf8(response.data)
    await this.state.passCallbacks(contract.cwVersion!, address!, response.messages)
    return response
  }

  protected checkVersion (exports: string[]): ScrtCWVersion|null {
    switch (true) {
      case !!(exports.indexOf('instantiate') > -1): return '1.x'
      case !!(exports.indexOf('init')        > -1): return '0.x'
    }
    return null
  }

  protected async passCallbacks (cwVersion: CW, sender:Address, messages: unknown[]) {
    if (!sender) throw new Error("mocknet.passCallbacks: can't pass callbacks without sender")
    switch (cwVersion) {
      case '0.x': return this.passCallbacks_CW0(sender, messages)
      case '1.x': return this.passCallbacks_CW1(sender, messages)
      default: throw Object.assign(new Error(`passCallbacks: unknown CW version ${cwVersion}`), {
        sender, messages
      })
    }
  }

  protected async passCallbacks_CW0 (sender: Address, messages: unknown[]) {
    for (const message of messages) {
      const { wasm } = message || {}
      if (!wasm) { this.log.warnNonWasm(message); continue }
      const { instantiate, execute } = wasm
      if (instantiate) {
        const { code_id: codeId, callback_code_hash: codeHash, label, msg, send } = instantiate
        const instance = await this.instantiate(sender, new ContractInstance({
          codeHash, codeId, label, initMsg: JSON.parse(b64toUtf8(msg)),
        }))
        this.log.debug(
          `callback from ${bold(sender)}: instantiated contract`, bold(label),
          'from code id', bold(codeId), 'with hash', bold(codeHash),
          'at address', bold(instance)
        )
      } else if (execute) {
        const { contract_addr, callback_code_hash, msg, send } = execute
        const response = await this.execute(
          sender,
          { address: contract_addr, codeHash: callback_code_hash },
          JSON.parse(b64toUtf8(msg)),
          { execSend: send }
        )
        this.log.debug(
          `Callback from ${bold(sender)}: executed transaction`,
          'on contract', bold(contract.address), 'with hash', bold(contract.codeHash),
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

  protected async passCallbacks_CW1 (sender: Address, messages: unknown[]) {
    for (const message of messages) {
      const { msg: { wasm = {} } = {} } = message||{}
      if (!wasm) { this.log.warnNonWasm(message); continue }
      const { instantiate, execute } = wasm
      if (instantiate) {
        const { code_id: codeId, code_hash: codeHash, label, msg, send } = instantiate
        const instance = await this.instantiate(sender, new ContractInstance({
          codeHash, codeId, label, initMsg: JSON.parse(b64toUtf8(msg)),
        }))
        this.log.debug(
          `callback from ${bold(sender)}: instantiated contract`, bold(label),
          'from code id', bold(codeId), 'with hash', bold(codeHash),
          'at address', bold(instance)
        )
      } else if (execute) {
        const { contract_addr, callback_code_hash, msg, send } = execute
        const response = await this.execute(
          sender,
          { address: contract_addr, codeHash: callback_code_hash },
          JSON.parse(b64toUtf8(msg)),
          { execSend: send }
        )
        this.log.debug(
          `Callback from ${bold(sender)}: executed transaction`,
          'on contract', bold(contract.address), 'with hash', bold(contract.codeHash),
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

export type ScrtCWAPI<V extends ScrtCWVersion> = {
  imports: {
    memory: WebAssembly.Memory
    env: {
      debug (msg: Pointer): Pointer

      db_read   (key: Pointer): Pointer
      db_write  (key: Pointer, val: Pointer): void
      db_remove (key: Pointer): void

      query_chain (req: Pointer): Pointer
    }
  },
  exports: Allocator & {
    query (msg: Pointer): Pointer
  }
} & ({
  /** CosmWasm v0 API */
  '0.x': {
    imports: {
      env: {
        canonicalize_address (src: Pointer, dst: Pointer): ErrCode
        humanize_address (src: Pointer, dst: Pointer): ErrCode
      }
    },
    exports: {
      init (env: Pointer, msg: Pointer): Pointer
      handle (env: Pointer, msg: Pointer): Pointer
    },
  },
  /** CosmWasm v0 API */
  '1.x': {
    imports: {
      memory: WebAssembly.Memory
      env: {
        addr_canonicalize (src: Pointer, dst: Pointer): ErrCode
        addr_humanize (src: Pointer, dst: Pointer): ErrCode
        addr_validate (addr: Pointer): ErrCode

        ed25519_sign (msg: Pointer, priv: Pointer): Pointer
        ed25519_verify (msg: Pointer, sig: Pointer, pub: Pointer): Pointer
        ed25519_batch_verify (msgs: Pointer, sigs: Pointer, pubs: Pointer): Pointer

        secp256k1_sign (msg: Pointer, priv: Pointer): Pointer
        secp256k1_verify (hash: Pointer, sig: Pointer, pub: Pointer): Pointer
        secp256k1_recover_pubkey (hash: Pointer, sig: Pointer, param: Pointer): Pointer

        gas_evaporate (...args: any): any
      }
    },
    exports: {
      requires_staking (): Pointer
      instantiate (env: Pointer, info: Pointer, msg: Pointer): Pointer
      execute (env: Pointer, info: Pointer, msg: Pointer): Pointer
    }
  }
}[V])

export class MocknetContract<V extends ScrtCWVersion> {
  log = new Console('mocknet')
  mocknet?:   ScrtMocknet
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
      default: throw new Error('Could not find init/instantiate entrypoint')
    }
  }

  get execMethod (): Function {
    switch (this.cwVersion) {
      case '0.x': return (this.runtime!.exports as CWAPI<'0.x'>['exports']).handle
      case '1.x': return (this.runtime!.exports as CWAPI<'1.x'>['exports']).execute
      default: throw new Error('Could not find handle/execute entrypoint')
    }
  }

  get queryMethod (): Function {
    return this.runtime!.exports.query
  }

  pass = (data: any): Pointer => passJson(this.runtime!.exports, data)

  readUtf8 = (ptr: Pointer) => JSON.parse(readUtf8(this.runtime!.exports, ptr))

  initPointers = ({ env, info, msg }: any = {}): Pointer[] => {
    if (typeof msg === 'undefined') throw new Error("Can't init contract with undefined init msg")
    switch (this.cwVersion) {
      case '0.x': return [this.pass(env), this.pass(msg)]
      case '1.x': return [this.pass(env), this.pass(info), this.pass(msg)]
      default: throw new Error('Could not find init/instantiate entrypoint parameters')
    }
  }

  execPointers = ({ env, info, msg }: any = {}): Pointer[] => {
    if (typeof msg === 'undefined') throw new Error("Can't execute empty transaction")
    switch (this.cwVersion) {
      case '0.x': return [this.pass(env), this.pass(msg)]
      case '1.x': return [this.pass(env), this.pass(info), this.pass(msg)]
      default: throw new Error('Could not find handle/execute entrypoint parameters')
    }
  }

  queryPointers = ({ env, msg }: any = {}): Pointer[] => {
    if (typeof msg === 'undefined') throw new Error("Can't perform empty query")
    switch (this.cwVersion) {
      case '0.x': return [this.pass(msg)]
      case '1.x': return [this.pass(env), this.pass(msg)]
      default: throw new Error('Could not find query entrypoint parameters')
    }
  }

  init = ({ sender, env, info, msg }: Partial<{
    sender: Address, env: object, info: object, msg: Message
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
      return this.readUtf8(this.initMethod(...this.initPointers({ env, info, msg })))
    } catch (e: any) {
      this.log
        .error(bold(this.address), `crashed on init:`, e.message)
        .error(bold('Args:'), { env, info, msg })
      throw e
    }
  }

  execute = ({ sender, env, info, msg }: {
    sender: Address, env?: object, info?: object, msg: Message
  }) => {
    const context = this.makeContext(sender)
    env ??= context.env
    info ??= context.info
    this.log.log(bold(this.address), `handle: ${JSON.stringify(msg)}`)
    try {
      return this.readUtf8(this.execMethod(...this.execPointers({ env, info, msg })))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on handle:`, e.message)
      this.log.error(bold('Args:'), { env, info, msg })
      throw e
    }
  }

  query = ({ env, msg }: {
    msg: Message, env?: object
  }) => {
    const context = this.makeContext('query')
    env ??= context.env
    this.log.log(bold(this.address), `query: ${JSON.stringify(msg)}`)
    try {
      const result = this.readUtf8(this.queryMethod(...this.queryPointers({ env, msg })))
      const parsed = JSON.parse(b64toUtf8(parseResult(result, 'query', this.address)))
      return parsed
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on query:`, e.message)
      throw e
    }
  }

  makeContext = (sender: Address, now: number = + new Date()) => {
    if (!this.mocknet) {
      throw new Error("missing mocknet for contract")
    }
    const chain_id = this.mocknet.chainId
    const height = Math.floor(now/5000)
    const time = Math.floor(now/1000)
    const sent_funds: any[] = []
    if (!this.address) {
      throw new Error("can't run contract without address")
    }
    if (!this.codeHash) {
      throw new Error("can't run contract without code hash")
    }
    const { address, codeHash } = this
    if (this.cwVersion === '0.x') {
      const block = { height, time, chain_id }
      const message = { sender, sent_funds }
      const contract = { address }
      const contract_key = ""
      const contract_code_hash = codeHash
      return { env: { block, message, contract, contract_key, contract_code_hash } }
    } else if (this.cwVersion === '1.x') {
      const block = { height, time: String(time), chain_id }
      const transaction = { index: 0 }
      const contract = { address }
      return { env: { block, transaction, contract }, info: { sender, funds: [] } }
    } else {
      throw new Error('Failed to detect CW API version for this contract')
    }
  }

  makeImports = (): { imports: CWAPI<V>['imports'], refresh: Function } => {
    const {log, runtime, storage, address, mocknet} = this
    // initial memory
    const wasmMemory = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    // when reentering, get the latest memory
    // See: https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324
    const refresh = () => {
      if (!this.runtime) throw new Error('WASM instance missing')
      const {memory, allocate} = this.runtime.exports
      return {memory, allocate}
    }

    let imports = {
      memory: wasmMemory,
      env: {
        db_read (keyPointer: Pointer) {
          const memory = refresh()
          const key = readUtf8(memory, keyPointer)
          const val = storage.get(key)
          log.debug(bold(address), `db_read: ${bold(key)}`, val ? brailleDump(val) : null)
          if (storage.has(key)) {
            return passBuffer(memory, val!)
          } else {
            return 0
          }
        },
        db_write (keyPointer: Pointer, valPointer: Pointer) {
          const memory = refresh()
          const key = readUtf8(memory, keyPointer)
          const val = readBuffer(memory, valPointer)
          storage.set(key, val)
          log.debug(bold(address), `db_write: ${bold(key)}`, brailleDump(val))
        },
        db_remove (keyPointer: Pointer) {
          const memory = refresh()
          const key = readUtf8(memory, keyPointer)
          log.debug(bold(address), `db_remove:`, bold(key))
          storage.delete(key)
        },
        query_chain (reqPointer: Pointer) {
          const memory = refresh()
          const req = readUtf8(memory, reqPointer)
          log.debug(bold(address), 'query_chain:', req)
          const { wasm } = JSON.parse(req)
          if (!wasm) {
            throw new Error("non-wasm query")
          }
          const { smart } = wasm
          if (!wasm) {
            throw new Error("non-smart query")
          }
          if (!mocknet) {
            throw new Error("missing mocknet backend")
          }
          const { contract_addr, callback_code_hash, msg } = smart
          const queried = mocknet.getContract(contract_addr)
          if (!queried) throw new Error(
            `MocknetContract ${address} made a query to contract ${contract_addr}` +
            ` which was not found in the Mocknet: ${JSON.stringify(req)}`
          )
          const decoded = JSON.parse(b64toUtf8(msg))
          log.debug(`${bold(address)} queries ${contract_addr}:`, decoded)
          const result = parseResult(queried.query({ msg: decoded }), 'query_chain', contract_addr)
          log.debug(`${bold(contract_addr)} responds to ${address}:`, b64toUtf8(result))
          return passJson(memory, { Ok: { Ok: result } })
          // https://docs.rs/secret-cosmwasm-std/latest/secret_cosmwasm_std/type.QuerierResult.html
        }
      }
    }

    if (this.cwVersion === '0.x') {

      imports = { ...imports, env: { ...imports.env,
        canonicalize_address (srcPointer: Pointer, dstPointer: Pointer) {
          const memory = refresh()
          const human  = readUtf8(memory, srcPointer)
          const canon  = bech32.fromWords(bech32.decode(human).words)
          const dst    = region(memory.memory.buffer, dstPointer)
          log.debug(bold(address), `canonize:`, human, '->', `${canon}`)
          writeToRegion(memory, dstPointer, canon)
          return 0
        },
        humanize_address (srcPointer: Pointer, dstPointer: Pointer) {
          const memory = refresh()
          const canon  = readBuffer(memory, srcPointer)
          const human  = bech32.encode(MOCKNET_ADDRESS_PREFIX, bech32.toWords(canon))
          const dst    = region(memory.memory.buffer, dstPointer)
          log.debug(bold(address), `humanize:`, canon, '->', human)
          writeToRegionUtf8(memory, dstPointer, human)
          return 0
        },
      } } as CWAPI<'0.x'>['imports']

    } else if (this.cwVersion === '1.x') {

      imports = { ...imports, env: { ...imports.env,

        addr_canonicalize (srcPointer: Pointer, dstPointer: Pointer) {
          const memory = refresh()
          const human  = readUtf8(memory, srcPointer)
          const canon  = bech32.fromWords(bech32.decode(human).words)
          const dst    = region(memory.memory.buffer, dstPointer)
          log.debug(bold(address), `canonize:`, human, '->', `${canon}`)
          writeToRegion(memory, dstPointer, canon)
          return 0
        },
        addr_humanize (srcPointer: Pointer, dstPointer: Pointer) {
          const memory = refresh()
          const canon  = readBuffer(memory, srcPointer)
          const human  = bech32.encode(MOCKNET_ADDRESS_PREFIX, bech32.toWords(canon))
          const dst    = region(memory.memory.buffer, dstPointer)
          log.debug(bold(address), `humanize:`, canon, '->', human)
          writeToRegionUtf8(memory, dstPointer, human)
          return 0
        },
        addr_validate (srcPointer: Pointer) {
          log.warnStub('addr_validate')
          return 0
        },

        secp256k1_sign (msg: Pointer, priv: Pointer) {
          const memory     = refresh()
          const message    = readBuffer(memory, msg)
          const privateKey = readBuffer(memory, priv)
          const signature  = secp256k1.sign(message, privateKey)
          return passBuffer(memory, signature.toCompactRawBytes())
        },
        secp256k1_verify (hashPointer: Pointer, sig: Pointer, pub: Pointer) {
          const memory    = refresh()
          const hash      = readBuffer(memory, hashPointer)
          const signature = readBuffer(memory, sig)
          const publicKey = readBuffer(memory, pub)
          const valid     = secp256k1.verify(signature, hash, publicKey)
          return valid ? 1 : 0
        },
        secp256k1_recover_pubkey (hashPointer: Pointer, sig: Pointer, param: Pointer) {
          const memory        = refresh()
          const hash          = readBuffer(memory, hashPointer)
          const signature     = secp256k1.Signature.fromCompact(readBuffer(memory, sig))
          const recoveryParam = readBuffer(memory, param)
          const recovered     = signature.recoverPublicKey(hash)
          log.warn('sec256k1_recover_pubkey: not implemented')
          return 0
        },

        ed25519_sign (msg: Pointer, priv: Pointer) {
          const memory    = refresh()
          const message   = readBuffer(memory, msg)
          const privKey   = readBuffer(memory, priv)
          const signature = ed25519.sign(message, privKey)
          return passBuffer(memory, signature)
          log.warnStub('ed25519_sign')
          return 0
        },
        ed25519_verify (msg: Pointer, sig: Pointer, pub: Pointer) {
          const memory    = refresh()
          const message   = readBuffer(memory, msg)
          const signature = readBuffer(memory, sig)
          const pubKey    = readBuffer(memory, pub)
          const valid     = ed25519.verify(signature, message, pubKey)
          return valid ? 1 : 0
        },
        ed25519_batch_verify (msgs: Pointer, sigs: Pointer, pubs: Pointer) {
          // ??? how to read &[&[u8]] ???
          const memory     = refresh()
          const messages   = readBuffer(memory, msgs)
          const signatures = readBuffer(memory, sigs)
          const publicKeys = readBuffer(memory, pubs)
          log.warnStub('ed25519_batch_verify')
          return 0
        },

        debug (ptr: Pointer) {
          const memory = refresh()
          log.debug(bold(address), `debug:`, readUtf8(memory, ptr))
          return 0
        },

        check_gas (): Pointer {
          log.debug('check_gas: not implemented')
          return 0
        },
        gas_evaporate (): Pointer {
          log.debug('gas_evaporate: not implemented')
          return 0
        }

      } } as CWAPI<'1.x'>['imports']

    } else {
      throw new Error('Failed to detect CW API version for this contract')
    }
    return {
      imports: imports as CWAPI<V>['imports'],
      refresh
    }
  }

}

declare namespace WebAssembly {
  class Module {
    static exports (module: Module): { name: string, kind: string }[]
  }
  function compile (code: unknown):
    Promise<Module>
  class Instance<T> {
    exports: T
  }
  function instantiate <V extends ScrtCWVersion> (code: unknown, world: unknown):
    Promise<Instance<CWAPI<V>['exports']>>
  class Memory {
    constructor (options: { initial: number, maximum: number })
    buffer: any
  }
}

/** Error code returned by contract. */
type ErrCode = number
/** Address in WASM VM memory. */
type Pointer     = number
/** Number of bytes. */
type Size    = number
/** Memory region as allocated by CosmWasm */
type Region = [Pointer, Size, Size, Uint32Array?]
/** Heap with allocator for talking to WASM-land */
interface Allocator {
  memory: WebAssembly.Memory
  allocate    (len: Size): Pointer
  deallocate? (ptr: Pointer): void
}

export const MOCKNET_ADDRESS_PREFIX = 'mocked'

export const codeHashForBlob = (blob: Uint8Array) => base16.encode(sha256(blob))

const decoder = new TextDecoder()
declare class TextDecoder { decode (data: any): string }

const encoder = new TextEncoder()
declare class TextEncoder { encode (data: string): any }

/** Convert a Result<T, E> returned from Rust side to Ok or throw */
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
export const region = (buffer: any, ptr: Pointer): Region => {
  const u32a = new Uint32Array(buffer)
  const addr = u32a[ptr/4+0] // Region.offset
  const size = u32a[ptr/4+1] // Region.capacity
  const used = u32a[ptr/4+2] // Region.length
  return [addr, size, used, u32a]
}

/** Read contents of region referenced by region pointer into a string. */
export const readUtf8 = ({ memory: { buffer }, deallocate }: Allocator, ptr: Pointer): string => {
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const view = new DataView(buffer, addr, used)
  const data = decoder.decode(view)
  drop({ deallocate }, ptr)
  return data
}

/** Read contents of region referenced by region pointer into a string. */
export const readBuffer = ({ memory: { buffer } }: Allocator, ptr: Pointer): Buffer => {
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const output = Buffer.alloc(size)
  for (let i = addr; i < addr + size; i++) {
    output[i - addr] = u8a[i]
  }
  return output
}

/** Serialize a datum into a JSON string and pass it into the contract. */
export const passJson = <T> (memory: Allocator, data: T): Pointer => {
  if (typeof data === 'undefined') throw new Error('Tried to pass undefined value into contract')
  return passBuffer(memory, utf8toBuffer(JSON.stringify(data)))
}

/** Allocate region, write data to it, and return the pointer.
  * See: https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324 */
export const passBuffer = ({ memory, allocate }: Allocator, data: ArrayLike<number>): Pointer => {
  const ptr = allocate(data.length)
  const { buffer } = memory // must be after allocation - see [1]
  const [ addr, _, __, u32a ] = region(buffer, ptr)
  u32a![ptr/4+2] = u32a![ptr/4+1] // set length to capacity
  write(buffer, addr, data)
  return ptr
}

/** Write UTF8-encoded data to address of region referenced by pointer. */
export const writeToRegionUtf8 = (memory: Allocator, ptr: Pointer, data: string): void =>
  writeToRegion(memory, ptr, encoder.encode(data))

/** Write data to address of region referenced by pointer. */
export const writeToRegion = (
  { memory: { buffer } }: Allocator, ptr: Pointer, data: ArrayLike<number>
): void => {
  const [addr, size, _, u32a] = region(buffer, ptr)
  if (data.length > size) { // if data length > Region.capacity
    throw new Error(`Mocknet: tried to write ${data.length} bytes to region of ${size} bytes`)
  }
  const usedPointer = ptr/4+2
  u32a![usedPointer] = data.length // set Region.length
  write(buffer, addr, data)
}

/** Write data to memory address. */
export const write = (buffer: ArrayLike<number>, addr: number, data: ArrayLike<number>): void =>
  new Uint8Array(buffer).set(data, addr)

/** Write UTF8-encoded data to memory address. */
export const writeUtf8 = (buffer: ArrayLike<number>, addr: number, data: string): void =>
  new Uint8Array(buffer).set(encoder.encode(data), addr)

/** Deallocate memory. Fails silently if no deallocate callback is exposed by the blob. */
export const drop = ({ deallocate }: { deallocate: Allocator['deallocate'] }, ptr: Pointer): void =>
  deallocate && deallocate(ptr)

/** Convert base64 string to utf8 string */
export const b64toUtf8 = (str: string) => Buffer.from(str, 'base64').toString('utf8')

/** Convert utf8 string to base64 string */
export const utf8toB64 = (str: string) => Buffer.from(str, 'utf8').toString('base64')

/** Convert utf8 string to buffer. */
export const utf8toBuffer = (str: string) => Buffer.from(str, 'utf8')

/** Convert buffer to utf8 string. */
export const bufferToUtf8 = (buf: Buffer) => buf.toString('utf8')
