import type {
  Address, CodeHash, ChainId, CodeId, Message, Client, Label, AnyContract
} from '../core/index'
import { into, Contract, bold } from '../core/index'

import Error from './MocknetError'
import Console from './MocknetConsole'

import { randomBech32, sha256, base16, bech32 } from '@hackbg/4mat'
import { brailleDump } from '@hackbg/dump'

export type CW = '0.x' | '1.x'

export default abstract class MocknetBackend {

  log = new Console('Mocknet')

  codeId = 0

  codeIdForCodeHash: Record<CodeHash, CodeId> = {}

  codeIdForAddress: Record<Address, CodeId> = {}

  labelForAddress: Record<Address, Label> = {}

  constructor (
    readonly chainId:   string,
    /** Map of code ID to WASM code blobs. */
    readonly uploads:   Record<CodeId, unknown>          = {},
    /** Map of addresses to WASM instances. */
    readonly instances: Record<Address, MocknetContract<any, any>> = {},
  ) {
    if (Object.keys(uploads).length > 0) {
      this.codeId = (Math.max(...Object.keys(uploads).map(x=>Number(x))) ?? 0) + 1
    }
  }
  getCode (codeId: CodeId) {
    const code = this.uploads[codeId]
    if (!code) throw new Error(`No code with id ${codeId}`)
    return code
  }
  upload (blob: Uint8Array) {
    const chainId  = this.chainId
    const codeId   = String(++this.codeId)
    const content  = this.uploads[codeId] = blob
    const codeHash = codeHashForBlob(blob)
    this.codeIdForCodeHash[codeHash] = String(codeId)
    return { codeId, codeHash }
  }
  getInstance (address?: Address) {
    if (!address) throw new Error.NoInstance()
    const instance = this.instances[address]
    if (!instance) throw new Error.NoInstanceAtAddress(address)
    return instance
  }
  async instantiate (
    sender:   Address,
    instance: AnyContract
  ): Promise<Partial<AnyContract>> {
    const label    = instance.label
    const initMsg  = await into(instance.initMsg)
    if (typeof initMsg === 'undefined') throw new Error('Tried to instantiate a contract with undefined initMsg')
    const chainId  = this.chainId
    const code     = this.getCode(instance.codeId!)
    const Contract = (this.constructor as any).Contract
    const contract = await new Contract(this).load(code, instance.codeId)
    const context  = this.context(sender, contract.address, instance.codeHash)
    const response = contract.init(...context, initMsg!)
    const initResponse = parseResult(response, 'instantiate', contract.address)
    this.instances[contract.address]        = contract
    this.codeIdForAddress[contract.address] = instance.codeId!
    this.labelForAddress[contract.address]  = label!
    await this.passCallbacks(contract.address, initResponse.messages)
    return {
      address:  contract.address,
      chainId,
      codeId:   instance.codeId,
      codeHash: instance.codeHash,
      label
    }
  }
  async execute (
    sender: Address,
    { address, codeHash }: Partial<Client>,
    msg:   Message,
    funds: unknown,
    memo?: unknown, 
    fee?:  unknown
  ) {
    const context  = this.context(sender, address)
    const result   = this.getInstance(address).execute(...context, msg)
    const response = parseResult(result, 'execute', address)
    if (response.data !== null) {
      response.data = b64toUtf8(response.data)
    }
    await this.passCallbacks(address, response.messages)
    return response
  }
  async passCallbacks (sender: Address|undefined, messages: Array<any>) {
    if (!sender) {
      throw new Error("MocknetBackend#passCallbacks: can't pass callbacks without sender")
    }
    for (const message of messages) {
      const { wasm } = message
      if (!wasm) {
        this.log.warn(
          'MocknetBackend#execute: transaction returned non-wasm message, ignoring:',
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
          'MocknetBackend#execute: transaction returned wasm message that was not '+
          '"instantiate" or "execute", ignoring:',
          message
        )
      }
    }
  }

  abstract query ({ address, codeHash }: Partial<Client>, msg: Message): any

  abstract context (...args: unknown[]): unknown[]

  static _makeContext (
    now: number = + new Date()
  ) {
    const height = Math.floor(now/5000)
    const time = Math.floor(now/1000)
    const sent_funds: any[] = []
    return { height, time, sent_funds }
  }
  static _makeImports (
    contract: MocknetContract<any, any>
  ): ContractImports & { getExports: Function } {
    const log = contract.log
    // initial memory
    const memory = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    // when reentering, get the latest memory
    const getExports = () => ({
      memory:   contract.instance!.exports.memory,
      allocate: contract.instance!.exports.allocate,
    })
    const methods = {
      db_read (keyPtr: Ptr) {
        const exports = getExports()
        const key     = readUtf8(exports, keyPtr)
        const val     = contract.storage.get(key)
        log.debug(bold(contract.address), `db_read: ${bold(key)}`, val ? brailleDump(val) : null)
        if (contract.storage.has(key)) {
          return passBuffer(exports, val!)
        } else {
          return 0
        }
      },
      db_write (keyPtr: Ptr, valPtr: Ptr) {
        const exports = getExports()
        const key     = readUtf8(exports, keyPtr)
        const val     = readBuffer(exports, valPtr)
        contract.storage.set(key, val)
        log.debug(bold(contract.address), `db_write: ${bold(key)}`, brailleDump(val))
      },
      db_remove (keyPtr: Ptr) {
        const exports = getExports()
        const key     = readUtf8(exports, keyPtr)
        log.debug(bold(contract.address), `db_remove:`, bold(key))
        contract.storage.delete(key)
      },
      query_chain (reqPtr: Ptr) {
        const exports  = getExports()
        const req      = readUtf8(exports, reqPtr)
        log.debug(bold(contract.address), 'query_chain:', req)
        const { wasm } = JSON.parse(req)
        if (!wasm) throw new Error(
          `MocknetContract ${contract.address} made a non-wasm query:`+
          ` ${JSON.stringify(req)}`
        )
        const { smart } = wasm
        if (!wasm) throw new Error(
          `MocknetContract ${contract.address} made a non-smart wasm query:`+
          ` ${JSON.stringify(req)}`
        )
        if (!contract.backend) throw new Error(
          `MocknetContract ${contract.address} made a query while isolated from`+
          ` the MocknetBackend: ${JSON.stringify(req)}`
        )
        const { contract_addr, callback_code_hash, msg } = smart
        const queried = contract.backend.getInstance(contract_addr)
        if (!queried) {
          throw new Error(
            `MocknetContract ${contract.address} made a query to contract ${contract_addr}` +
            ` which was not found in the MocknetBackend: ${JSON.stringify(req)}`
          )
        }
        const decoded = JSON.parse(b64toUtf8(msg))
        log.debug(`${bold(contract.address)} queries ${contract_addr}:`, decoded)
        const result = parseResult(queried.query(decoded), 'query_chain', contract_addr)
        log.debug(`${bold(contract_addr)} responds to ${contract.address}:`, b64toUtf8(result))
        return pass(exports, { Ok: { Ok: result } })
        // https://docs.rs/secret-cosmwasm-std/latest/secret_cosmwasm_std/type.QuerierResult.html
      }
    }
    return { memory, getExports, env: methods }
  }
}

export abstract class MocknetContract<I extends ContractImports, E extends ContractExports> {
  log = new Console('Mocknet')
  /** The instance of the contract code. */
  instance?: WebAssembly.Instance<E>
  /** The contract's basic key-value storage. */
  storage = new Map<string, Buffer>()

  constructor (
    readonly backend:   MocknetBackend|null = null,
    readonly address:   Address = randomBech32(MOCKNET_ADDRESS_PREFIX),
    readonly codeHash?: CodeHash,
    readonly codeId?:   CodeId,
  ) {}

  async load (code: unknown, codeId?: CodeId) {
    return Object.assign(this, {
      codeId:   this.codeId,
      instance: (await WebAssembly.instantiate(code, this.makeImports())).instance,
      codeHash: codeHashForBlob(code as Buffer)
    })
  }
  pass (data: any): Ptr {
    return pass(this.instance!.exports, data)
  }
  readUtf8 (ptr: Ptr) {
    return JSON.parse(readUtf8(this.instance!.exports, ptr))
  }
  init (...args: unknown[]) {
    const msg = args[args.length - 1]
    try {
      const init = this.initMethod
      if (!init) {
        this.log.error('WASM exports of contract:', ...Object.keys(this.instance?.exports??{}))
        throw new Error('Missing init entrypoint in contract.')
      }
      return this.readUtf8(this.initMethod(...this.initPtrs(...args)))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on init:`, e.message)
      this.log.error(bold('Args:'), ...args)
      throw e
    }
  }
  execute (...args: unknown[]) {
    const msg = args[args.length - 1]
    this.log.log(bold(this.address), `handle: ${JSON.stringify(msg)}`)
    try {
      return this.readUtf8(this.execMethod(...this.execPtrs(...args)))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on handle:`, e.message)
      this.log.error(bold('Args:'), ...args)
      throw e
    }
  }
  query (...args: unknown[]) {
    const msg = args[args.length - 1]
    this.log.log(bold(this.address), `query: ${JSON.stringify(msg)}`)
    try {
      return this.readUtf8(this.queryMethod(...this.queryPtrs(...args)))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on query:`, e.message)
      throw e
    }
  }

  abstract get initMethod (): Function

  abstract get execMethod (): Function

  abstract get queryMethod (): Function

  abstract makeImports (): I

  abstract initPtrs (...args: unknown[]): unknown[]

  abstract execPtrs (...args: unknown[]): unknown[]

  abstract queryPtrs (...args: unknown[]): unknown[]

}
export interface ContractImports {
  memory: WebAssembly.Memory
  env: {
    db_read (key: Ptr): Ptr
    db_write (key: Ptr, val: Ptr): void
    db_remove (key: Ptr): void
    query_chain (req: Ptr): Ptr
  }
}
export interface ContractExports extends IOExports {
  query (msg: Ptr): Ptr
}

export class MocknetBackend_CW0 extends MocknetBackend {
  context (
    sender:   Address,
    address?: Address,
    codeHash: CodeHash|undefined = address ? this.instances[address]?.codeHash : undefined,
    now:      number             = + new Date()
  ): [unknown] {
    return MocknetBackend_CW0.makeContext(this.chainId, sender, address, codeHash, now)
  }
  async query ({ address, codeHash }: Partial<Client>, msg: Message) {
    const result = b64toUtf8(parseResult(this.getInstance(address).query(msg), 'query', address))
    return JSON.parse(result)
  }

  /** Contract host class for CW0. */
  static Contract: typeof MocknetContract_CW0
  /** Create the Env context parameter for a CW0 contract. */
  static makeContext (
    chain_id:  ChainId,
    sender:    Address,
    address?:  Address,
    codeHash?: CodeHash|undefined,
    now:       number = + new Date()
  ): [unknown] {
    if (!address) throw new Error.ContextNoAddress()
    const { height, time, sent_funds } = MocknetBackend._makeContext()
    return [{
      block:    { height, time, chain_id },
      message:  { sender, sent_funds },
      contract: { address },
      contract_key: "",
      contract_code_hash: codeHash
    }]
  }
  static makeImports (contract: MocknetContract<ContractImports_CW0, ContractExports_CW0>) {
    const log = contract.log
    const { memory, getExports, env } = MocknetBackend._makeImports(contract)
    const cw0Methods = {
      canonicalize_address (srcPtr: Ptr, dstPtr: Ptr) {
        const exports = getExports()
        const human   = readUtf8(exports, srcPtr)
        const canon   = bech32.fromWords(bech32.decode(human).words)
        const dst     = region(exports.memory.buffer, dstPtr)
        log.debug(bold(contract.address), `canonize:`, human, '->', `${canon}`)
        writeToRegion(exports, dstPtr, canon)
        return 0
      },
      humanize_address (srcPtr: Ptr, dstPtr: Ptr) {
        const exports = getExports()
        const canon   = readBuffer(exports, srcPtr)
        const human   = bech32.encode(MOCKNET_ADDRESS_PREFIX, bech32.toWords(canon))
        const dst     = region(exports.memory.buffer, dstPtr)
        log.debug(bold(contract.address), `humanize:`, canon, '->', human)
        writeToRegionUtf8(exports, dstPtr, human)
        return 0
      },
    }
    return { memory, env: { ...env, ...cw0Methods } }
  }
}
/** Host for a WASM contract in a CW0 environment. */
export class MocknetContract_CW0 extends MocknetContract<ContractImports_CW0, ContractExports_CW0> {
  get initMethod () {
    return this.instance!.exports.init
  }
  get execMethod () {
    return this.instance!.exports.handle
  }
  get queryMethod () {
    return this.instance!.exports.query
  }
  initPtrs (env: unknown, msg: Message): [Ptr, Ptr] {
    return [this.pass(env), this.pass(msg)]
  }
  execPtrs (env: unknown, msg: Message): [Ptr, Ptr] {
    return [this.pass(env), this.pass(msg)]
  }
  queryPtrs (msg: Message): [Ptr] {
    return [this.pass(msg)]
  }
  makeImports (): ContractImports_CW0 {
    return MocknetBackend_CW0.makeImports(this)
  }
}
Object.assign(MocknetBackend_CW0, { Contract: MocknetContract_CW0 })
/** The API that a CW0.10 contract expects. */
export interface ContractImports_CW0 extends ContractImports {
  env: ContractImports['env'] & {
    canonicalize_address (src: Ptr, dst: Ptr): ErrCode
    humanize_address     (src: Ptr, dst: Ptr): ErrCode
  }
}
/** A CW0.10 contract's raw API methods. */
export interface ContractExports_CW0 extends ContractExports {
  init   (env: Ptr, msg: Ptr): Ptr
  handle (env: Ptr, msg: Ptr): Ptr
}

export class MocknetBackend_CW1 extends MocknetBackend {
  context (
    sender:   Address,
    address?: Address,
    codeHash: CodeHash|undefined = address ? this.instances[address]?.codeHash : undefined,
    now:      number             = + new Date()
  ): [unknown, unknown] {
    return MocknetBackend_CW1.makeContext(this.chainId, sender, address, codeHash, now)
  }
  async query ({ address, codeHash }: Partial<Client>, msg: Message) {
    const [env] = this.context('', address, codeHash)
    const result = b64toUtf8(parseResult(this.getInstance(address).query(env, msg), 'query', address))
    return JSON.parse(result)
  }

  /** Contract host class for CW1. */
  static Contract: typeof MocknetContract_CW1
  /** Create the Env and Info context parameters for a CW1 contract. */
  static makeContext (
    chain_id:  ChainId,
    sender:    Address,
    address?:  Address,
    codeHash?: CodeHash|undefined,
    now:       number = + new Date()
  ): [unknown, unknown] {
    if (!address) throw new Error.ContextNoAddress()
    const { height, time, sent_funds } = MocknetBackend._makeContext()
    return [{
      block:       { height, time: String(time), chain_id },
      transaction: { index: 0 },
      contract:    { address }
    }, {
      sender, funds: []
    }]
  }
  static makeImports (contract: MocknetContract<ContractImports_CW1, ContractExports_CW1>) {
    const log = contract.log
    const { memory, getExports, env } = MocknetBackend._makeImports(contract)
    const cw1Methods = {
      addr_canonicalize (srcPtr: Ptr, dstPtr: Ptr) {
        const exports = getExports()
        const human   = readUtf8(exports, srcPtr)
        const canon   = bech32.fromWords(bech32.decode(human).words)
        const dst     = region(exports.memory.buffer, dstPtr)
        log.debug(bold(contract.address), `canonize:`, human, '->', `${canon}`)
        writeToRegion(exports, dstPtr, canon)
        return 0
      },
      addr_humanize (srcPtr: Ptr, dstPtr: Ptr) {
        const exports = getExports()
        const canon   = readBuffer(exports, srcPtr)
        const human   = bech32.encode(MOCKNET_ADDRESS_PREFIX, bech32.toWords(canon))
        const dst     = region(exports.memory.buffer, dstPtr)
        log.debug(bold(contract.address), `humanize:`, canon, '->', human)
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
        const exports = getExports()
        log.debug(bold(contract.address), `debug:`, readUtf8(exports, ptr))
        return 0
      },
    }
    return { memory, env: { ...env, ...cw1Methods } }
  }
}
/** Host for a WASM contract in a CW1 environment. */
export class MocknetContract_CW1 extends MocknetContract<ContractImports_CW1, ContractExports_CW1> {
  get initMethod () {
    return this.instance!.exports.instantiate
  }
  get execMethod () {
    return this.instance!.exports.execute
  }
  get queryMethod () {
    return this.instance!.exports.query
  }
  initPtrs (env: unknown, info: unknown, msg: Message): [Ptr, Ptr, Ptr] {
    if (typeof msg === 'undefined') throw new Error('Tried to init contract with undefined init msg')
    return [this.pass(env), this.pass(info), this.pass(msg)]
  }
  execPtrs (env: unknown, info: unknown, msg: Message): [Ptr, Ptr, Ptr] {
    return [this.pass(env), this.pass(info), this.pass(msg)]
  }
  queryPtrs (env: unknown, msg: Message): [Ptr, Ptr] {
    return [this.pass(env), this.pass(msg)]
  }
  makeImports (): ContractImports_CW1 {
    return MocknetBackend_CW1.makeImports(this)
  }
}
Object.assign(MocknetBackend_CW1, { Contract: MocknetContract_CW1 })
/** The API that a CW1.0 contract expects. */
export interface ContractImports_CW1 extends ContractImports {
  env: ContractImports['env'] & {
    addr_canonicalize        (src:  Ptr, dst: Ptr): ErrCode
    addr_humanize            (src:  Ptr, dst: Ptr): ErrCode
    addr_validate            (addr: Ptr):           ErrCode
    debug                    (key:  Ptr):           Ptr
    ed25519_batch_verify     (x:    Ptr):           Ptr
    ed25519_sign             (x:    Ptr, y:   Ptr): Ptr
    ed25519_verify           (x:    Ptr, y:   Ptr): Ptr
    secp256k1_recover_pubkey (x:    Ptr):           Ptr
    secp256k1_sign           (x:    Ptr, y:   Ptr): Ptr
    secp256k1_verify         (x:    Ptr, y:   Ptr): Ptr
  }
}
/** A CW1.0 contract's raw API methods. */
export interface ContractExports_CW1 extends ContractExports {
  instantiate      (env: Ptr, info: Ptr, msg: Ptr): Ptr
  execute          (env: Ptr, info: Ptr, msg: Ptr): Ptr
  requires_staking ():                              Ptr
}

declare namespace WebAssembly {
  class Memory {
    constructor ({ initial, maximum }: { initial: number, maximum: number })
    buffer: any
  }
  class Instance<T> {
    exports: T
  }
  function instantiate (code: unknown, world: unknown): {
    instance: WebAssembly.Instance<ContractExports>
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
export interface IOExports {
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
export const readUtf8 = (exports: IOExports, ptr: Ptr): string => {
  const { buffer } = exports.memory
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const view = new DataView(buffer, addr, used)
  const data = decoder.decode(view)
  drop(exports, ptr)
  return data
}
/** Read contents of region referenced by region pointer into a string. */
export const readBuffer = (exports: IOExports, ptr: Ptr): Buffer => {
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
export const pass = <T> (exports: IOExports, data: T): Ptr => {
  if (typeof data === 'undefined') throw new Error('Tried to pass undefined value into contract')
  const buffer = utf8toBuffer(JSON.stringify(data))
  return passBuffer(exports, buffer)
}
/** Allocate region, write data to it, and return the pointer.
  * See: https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324 */
export const passBuffer = (exports: IOExports, buf: Buffer): Ptr => {
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
  { memory: { buffer } }: IOExports, ptr: Ptr, data: ArrayLike<number>
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
export const writeToRegionUtf8 = (exports: IOExports, ptr: Ptr, data: string): void =>
  writeToRegion(exports, ptr, encoder.encode(data))
/** Deallocate memory. Fails silently if no deallocate callback is exposed by the blob. */
export const drop = ({ deallocate }: IOExports, ptr: Ptr): void => deallocate && deallocate(ptr)
/** Convert base64 string to utf8 string */
export const b64toUtf8 = (str: string) => Buffer.from(str, 'base64').toString('utf8')
/** Convert utf8 string to base64 string */
export const utf8toB64 = (str: string) => Buffer.from(str, 'utf8').toString('base64')
/** Convert utf8 string to buffer. */
export const utf8toBuffer = (str: string) => Buffer.from(str, 'utf8')
/** Convert buffer to utf8 string. */
export const bufferToUtf8 = (buf: Buffer) => buf.toString('utf8')

//type CW<V extends '0'|'1'> = {
  //'0':{},
  //'1':{}
//}[V]
