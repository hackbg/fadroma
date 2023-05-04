import type {
  Address, CodeHash, ChainId, CodeId, Message, Client, Label, AnyContract
} from '../agent'
import { into, Contract, bold } from '../agent'
import { Error, Console } from './mocknet-base'
import type { Mocknet } from './mocknet-chain'
import { randomBech32, sha256, base16, bech32 } from '@hackbg/4mat'
import { brailleDump } from '@hackbg/dump'

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
    switch (this.cwVersion) {
      case '0.x': return [this.pass(env), this.pass(msg)]
      case '1.x':
        if (typeof msg === 'undefined') throw new Error("Can't init contract with undefined init msg")
        return [this.pass(env), this.pass(info), this.pass(msg)]
      default: throw new Error('Invalid CW API version. Supported are "0.x" and "1.x"')
    }
  }

  execPtrs = ({ env, info, msg }: any = {}): Ptr[] => {
    switch (this.cwVersion) {
      case '0.x': return [this.pass(env), this.pass(msg)]
      case '1.x': return [this.pass(env), this.pass(info), this.pass(msg)]
      default: throw new Error('Invalid CW API version. Supported are "0.x" and "1.x"')
    }
  }

  queryPtrs = ({ env, msg }: any = {}): Ptr[] => {
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
    env  ??= context.env
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
    env  ??= context.env
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
    env  ??= context.env
    this.log.log(bold(this.address), `query: ${JSON.stringify(msg)}`)
    try {
      return this.readUtf8(this.queryMethod(...this.queryPtrs({ env, msg })))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on query:`, e.message)
      throw e
    }
  }

  async load (code: unknown): Promise<this & {
    runtime:  WebAssembly.Instance<CWAPI<V>['exports']>,
    codeHash: CodeHash
  }> {
    const {imports, refresh} = this.makeImports()
    const {instance: runtime} = await WebAssembly.instantiate(code, imports)
    return Object.assign(this, { runtime, codeHash: codeHashForBlob(code as Buffer) })
  }

  makeImports = (): { imports: CWAPI<V>['imports'], refresh: Function } => {
    const {log, runtime, storage, address, mocknet} = this
    // initial memory
    const memory = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    // when reentering, get the latest memory
    const refresh = () => ({
      memory:   runtime!.exports.memory,
      allocate: runtime!.exports.allocate,
    })
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
export type ErrCode = number
/** Address in WASM VM memory. */
export type Ptr     = number
/** Number of bytes. */
export type Size    = number
/** Memory region as allocated by CosmWasm */
export type Region = [Ptr, Size, Size, Uint32Array?]
/** Heap with allocator for talking to WASM-land */
export interface Memory {
  memory:                  WebAssembly.Memory
  allocate    (len: Size): Ptr
  deallocate? (ptr: Ptr):  void
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
