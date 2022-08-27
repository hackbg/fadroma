import { bold } from '@hackbg/konzola'
import * as Fadroma from '@fadroma/client'
import * as Formati from '@hackbg/formati'

/** Chain instance containing a local MocknetBackend. */
export default class Mocknet extends Fadroma.Chain {
  defaultDenom = 'umock'
  constructor (id = 'fadroma-mocknet', options = {}) {
    super(id, { ...options, mode: Fadroma.ChainMode.Mocknet })
  }
  backend = new MocknetBackend(this.id)
  //@ts-ignore
  async getAgent <A extends MocknetAgent> (options: AgentOpts): Promise<A> {
    return new MocknetAgent(this, options) as A
  }
  async query <T, U> (contract: Partial<Fadroma.Contract>, msg: T): Promise<U> {
    return this.backend.query(contract, msg as Fadroma.Message)
  }
  async getHash (_: any) {
    return Promise.resolve("SomeCodeHash")
  }
  async getCodeId (_: any) {
    return Promise.resolve("1")
  }
  async getLabel (_: any) {
    return "SomeLabel"
  }
  async getBalance (_: string) {
    return "0"
  }
  get height () {
    return Promise.resolve(0)
  }

  /** Agent instance calling its Chain's Mocknet backend. */
  //@ts-ignore
  static Agent: Fadroma.AgentCtor<MocknetAgent>

  //@ts-ignore
  Agent: Fadroma.AgentCtor<MocknetAgent> = Mocknet.Agent
}

//@ts-ignore
class MocknetAgent extends Fadroma.Agent {
  get defaultDenom () { return this.chain.defaultDenom }
  static async create (chain: Mocknet, options: Fadroma.AgentOpts) {
    return new MocknetAgent(chain, options)
  }
  constructor (readonly chain: Mocknet, readonly options: Fadroma.AgentOpts) {
    super(chain as Fadroma.Chain, options)
  }
  name:    string  = 'MocknetAgent'
  address: Fadroma.Address = Formati.randomBech32(MOCKNET_ADDRESS_PREFIX)
  get backend (): MocknetBackend {
    const { backend }: Mocknet = this.chain as unknown as Mocknet
    return backend
  }
  async upload (blob: Uint8Array) {
    return await this.backend.upload(blob)
  }
  async instantiate <T> (
    template: Fadroma.Template, label: string, msg: T, send = []
  ): Promise<Fadroma.Contract> {
    return await this.backend.instantiate(this.address, template, label, msg as Fadroma.Message, send)
  }
  async execute <R> (
    instance: Partial<Fadroma.Contract>, msg: Fadroma.Message, opts: Fadroma.ExecOpts = {}
  ): Promise<R> {
    return await this.backend.execute(this.address, instance, msg, opts.send, opts.memo, opts.fee)
  }
  async query <R> (
    instance: Partial<Fadroma.Contract>, msg: Fadroma.Message
  ): Promise<R> {
    return await this.chain.query(instance, msg)
  }
  get nextBlock () {
    return Promise.resolve(0)
  }
  get block     () {
    return Promise.resolve(0)
  }
  get account   () {
    return Promise.resolve()
  }
  get balance   () {
    return Promise.resolve("0")
  }
  getBalance (_: string) {
    return Promise.resolve("0")
  }
  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any) {
    return Promise.resolve()
  }
  sendMany (_1:any, _2:any, _3?:any, _4?:any) {
    return Promise.resolve()
  }
  /** Message bundle that warns about unsupported messages. */
  static Bundle: Fadroma.BundleCtor<MocknetBundle>
}

//@ts-ignore
Mocknet.Agent = MocknetAgent

class MocknetBundle extends Fadroma.Bundle {
  //declare agent: MocknetAgent
  async submit (memo = "") {
    const results = []
    for (const { init, exec } of this.msgs) {
      if (init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        const template = new Fadroma.Template({ codeHash, codeId: String(codeId) })
        //@ts-ignore
        results.push(await this.agent.instantiate(template, label, msg, funds))
      } else if (exec) {
        const { sender, contract, codeHash, msg, funds } = exec
        results.push(await this.agent.execute({ address: contract, codeHash }, msg, { send: funds }))
      } else {
        console.warn('MocknetBundle#submit: found unknown message in bundle, ignoring')
        results.push(null)
      }
    }
    return results
  }
  save (name: string): Promise<unknown> {
    throw new Error('MocknetBundle#save: not implemented')
  }
}

Mocknet.Agent.Bundle = MocknetBundle

const decoder = new TextDecoder()
const encoder = new TextEncoder()
declare class TextDecoder { decode (data: any): string }
declare class TextEncoder { encode (data: string): any }
declare namespace WebAssembly {
  class Memory {
    constructor ({ initial, maximum }: { initial: number, maximum: number })
    buffer: Buffer
  }
  class Instance<T> {
    exports: T
  }
  function instantiate (code: unknown, world: unknown): {
    instance: WebAssembly.Instance<ContractExports>
  }
}
export type ErrCode = number
export type Ptr     = number
export type Size    = number
/** Memory region as allocated by CosmWasm */
export type Region = [Ptr, Size, Size, Uint32Array?]
/** Heap with allocator for talking to WASM-land */
export interface IOExports {
  memory:                           WebAssembly.Memory
  allocate    (len: Size):          Ptr
  deallocate? (ptr: Ptr):           void
}
/** Contract's raw API methods, taking and returning heap pointers. */
export interface ContractExports extends IOExports {
  init        (env: Ptr, msg: Ptr): Ptr
  handle      (env: Ptr, msg: Ptr): Ptr
  query       (msg: Ptr):           Ptr
}
export interface ContractImports {
  memory: WebAssembly.Memory
  env: {
    db_read              (key: Ptr):           Ptr
    db_write             (key: Ptr, val: Ptr): void
    db_remove            (key: Ptr):           void
    canonicalize_address (src: Ptr, dst: Ptr): ErrCode
    humanize_address     (src: Ptr, dst: Ptr): ErrCode
    query_chain          (req: Ptr):           Ptr
  }
}

export const MOCKNET_ADDRESS_PREFIX = 'mocked'

// TODO move this env var to global config
const trace = process.env.FADROMA_MOCKNET_DEBUG ? ((...args: any[]) => {
  console.info(...args)
  console.log()
}) : (...args: any[]) => {}

const debug = process.env.FADROMA_MOCKNET_DEBUG ? ((...args: any[]) => {
  console.debug(...args)
  console.log()
}) : (...args: any[]) => {}

/** Hosts MocknetContract instances. */
export class MocknetBackend {
  constructor (readonly chainId: string) {}
  codeId  = 0
  uploads: Record<Fadroma.CodeId, unknown> = {}
  getCode (codeId: Fadroma.CodeId) {
    const code = this.uploads[codeId]
    if (!code) {
      throw new Error(`No code with id ${codeId}`)
    }
    return code
  }
  upload (blob: Uint8Array): Fadroma.Template {
    const chainId  = this.chainId
    const codeId   = ++this.codeId
    const content  = this.uploads[codeId] = blob
    const codeHash = codeHashForBlob(blob)
    return new Fadroma.Template({ codeHash, chainId, codeId: String(codeId) })
  }
  instances: Record<Fadroma.Address, MocknetContract> = {}
  getInstance (address?: Fadroma.Address) {
    if (!address) {
      throw new Error(`MocknetBackend#getInstance: can't get instance without address`)
    }
    const instance = this.instances[address]
    if (!instance) {
      throw new Error(`MocknetBackend#getInstance: no contract at ${address}`)
    }
    return instance
  }
  async instantiate (
    sender: Fadroma.Address,
    { codeId, codeHash }: Partial<Fadroma.Template>,
    label: string,
    msg:   Fadroma.Message,
    funds = []
  ): Promise<Fadroma.Contract> {
    const chainId  = this.chainId
    const code     = this.getCode(codeId!)
    const contract = await new MocknetBackend.Contract(this).load(code)
    const env      = this.makeEnv(sender, contract.address, codeHash)
    const response = contract.init(env, msg)
    const initResponse = parseResult(response, 'instantiate', contract.address)
    this.instances[contract.address] = contract
    await this.passCallbacks(contract.address, initResponse.messages)
    return new Fadroma.Contract({ chainId, codeId, codeHash, address: contract.address, label })
  }
  async execute (
    sender: Fadroma.Address,
    { address, codeHash }: Partial<Fadroma.Contract>,
    msg: Fadroma.Message,
    funds: unknown,
    memo?: unknown, 
    fee?:  unknown
  ) {
    const result   = this.getInstance(address).handle(this.makeEnv(sender, address), msg)
    const response = parseResult(result, 'execute', address)
    if (response.data !== null) {
      response.data = b64toUtf8(response.data)
    }
    await this.passCallbacks(address, response.messages)
    return response
  }
  /** Populate the `Env` object available in transactions. */
  makeEnv (
    sender:   Fadroma.Address,
    address?: Fadroma.Address,
    codeHash: Fadroma.CodeHash|undefined = address ? this.instances[address]?.codeHash : undefined,
    now: number = + new Date()
  ) {
    if (!address) {
      throw new Error("MocknetBackend#makeEnv: Can't create contract environment without address")
    }
    const height            = Math.floor(now/5000)
    const time              = Math.floor(now/1000)
    const chain_id          = this.chainId
    const sent_funds: any[] = []
    return {
      block:    { height, time, chain_id },
      message:  { sender, sent_funds },
      contract: { address },
      contract_key: "",
      contract_code_hash: codeHash
    }
  }
  async passCallbacks (sender: Fadroma.Address|undefined, messages: Array<any>) {
    if (!sender) {
      throw new Error("MocknetBackend#passCallbacks: can't pass callbacks without sender")
    }
    for (const message of messages) {
      const { wasm } = message
      if (!wasm) {
        console.warn(
          'MocknetBackend#execute: transaction returned non-wasm message, ignoring:',
          message
        )
        continue
      }
      const { instantiate, execute } = wasm
      if (instantiate) {
        const { code_id, callback_code_hash, label, msg, send } = instantiate
        const instance = await this.instantiate(
          sender, /* who is sender? */
          new Fadroma.Template({ codeHash: callback_code_hash, codeId: code_id }),
          label,
          JSON.parse(b64toUtf8(msg)),
          send
        )
        trace(
          `Callback from ${bold(sender)}: instantiated contract`, bold(label),
          'from code id', bold(code_id), 'with hash', bold(callback_code_hash),
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
        trace(
          `Callback from ${bold(sender)}: executed transaction`,
          'on contract', bold(contract_addr), 'with hash', bold(callback_code_hash),
        )
      } else {
        console.warn(
          'MocknetBackend#execute: transaction returned wasm message that was not '+
          '"instantiate" or "execute", ignoring:',
          message
        )
      }
    }
  }
  async query ({ address, codeHash }: Partial<Fadroma.Contract>, msg: Fadroma.Message) {
    const result = b64toUtf8(parseResult(this.getInstance(address).query(msg), 'query', address))
    return JSON.parse(result)
  }
  private resultOf (address: Fadroma.Address, action: string, response: any) {
    const { Ok, Err } = response
    if (Err !== undefined) {
      const errData = JSON.stringify(Err)
      const message = `MocknetBackend#${action}: contract ${address} returned Err: ${errData}`
      throw Object.assign(new Error(message), Err)
    }
    if (Ok !== undefined) {
      return Ok
    }
    throw new Error(`MocknetBackend#${action}: contract ${address} returned non-Result type`)
  }

  /** Hosts a WASM contract blob and contains the contract-local storage. */
  static Contract: typeof MocknetContract

}

class MocknetContract {
  constructor (
    readonly backend:   MocknetBackend|null = null,
    readonly address:   Fadroma.Address     = Formati.randomBech32(MOCKNET_ADDRESS_PREFIX),
    readonly codeHash?: Fadroma.CodeHash
  ) {
    trace('Instantiating', bold(address))
  }
  instance?: WebAssembly.Instance<ContractExports>
  async load (code: unknown) {
    const { instance } = await WebAssembly.instantiate(code, this.makeImports())
    this.instance = instance
    return this
  }
  init (env: unknown, msg: Fadroma.Message) {
    debug(`${bold(this.address)} init:`, msg)
    try {
      const envBuf  = this.pass(env)
      const msgBuf  = this.pass(msg)
      const retPtr  = this.instance!.exports.init(envBuf, msgBuf)
      const retData = this.readUtf8(retPtr)
      return retData
    } catch (e) {
      console.error(bold(this.address), `crashed on init:`, e.message)
      throw e
    }
  }
  handle (env: unknown, msg: Fadroma.Message) {
    debug(`${bold(this.address)} handle:`, msg)
    try {
      const envBuf = this.pass(env)
      const msgBuf = this.pass(msg)
      const retPtr = this.instance!.exports.handle(envBuf, msgBuf)
      const retBuf = this.readUtf8(retPtr)
      return retBuf
    } catch (e) {
      console.error(bold(this.address), `crashed on handle:`, e.message)
      throw e
    }
  }
  query (msg: Fadroma.Message) {
    debug(`${bold(this.address)} query:`, msg)
    try {
      const msgBuf = this.pass(msg)
      const retPtr = this.instance!.exports.query(msgBuf)
      const retBuf = this.readUtf8(retPtr)
      return retBuf
    } catch (e) {
      console.error(bold(this.address), `crashed on query:`, e.message)
      throw e
    }
  }
  pass (data: any): Ptr {
    return pass(this.instance!.exports, data)
  }
  readUtf8 (ptr: Ptr) {
    return JSON.parse(readUtf8(this.instance!.exports, ptr))
  }
  storage = new Map<string, Buffer>()

  /** TODO: these are different for different chains. */
  makeImports (): ContractImports {
    // don't destructure - when first instantiating the
    // contract, `this.instance` is still undefined
    const contract = this
    // initial blank memory
    const memory   = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    // when reentering, get the latest memory
    const getExports = () => ({
      memory:   contract.instance!.exports.memory,
      allocate: contract.instance!.exports.allocate,
    })
    return {
      memory,
      env: {
        db_read (keyPtr) {
          const exports = getExports()
          const key     = readUtf8(exports, keyPtr)
          const val     = contract.storage.get(key)
          trace(bold(contract.address), `db_read:`, bold(key), '=', val)
          if (contract.storage.has(key)) {
            return passBuffer(exports, val!)
          } else {
            return 0
          }
        },
        db_write (keyPtr, valPtr) {
          const exports = getExports()
          const key     = readUtf8(exports, keyPtr)
          const val     = readBuffer(exports, valPtr)
          contract.storage.set(key, val)
          trace(bold(contract.address), `db_write:`, bold(key), '=', val)
        },
        db_remove (keyPtr) {
          const exports = getExports()
          const key     = readUtf8(exports, keyPtr)
          trace(bold(contract.address), `db_remove:`, bold(key))
          contract.storage.delete(key)
        },
        canonicalize_address (srcPtr, dstPtr) {
          const exports = getExports()
          const human   = readUtf8(exports, srcPtr)
          const canon   = Formati.bech32.fromWords(Formati.bech32.decode(human).words)
          const dst     = region(exports.memory.buffer, dstPtr)
          trace(bold(contract.address), `canonize:`, human, '->', `${canon}`)
          writeToRegion(exports, dstPtr, canon)
          return 0
        },
        humanize_address (srcPtr, dstPtr) {
          const exports = getExports()
          const canon   = readBuffer(exports, srcPtr)
          const human   = Formati.bech32.encode(MOCKNET_ADDRESS_PREFIX, Formati.bech32.toWords(canon))
          const dst     = region(exports.memory.buffer, dstPtr)
          trace(bold(contract.address), `humanize:`, canon, '->', human)
          writeToRegionUtf8(exports, dstPtr, human)
          return 0
        },
        query_chain (reqPtr) {
          const exports  = getExports()
          const req      = readUtf8(exports, reqPtr)
          trace(bold(contract.address), 'query_chain:', req)
          const { wasm } = JSON.parse(req)
          if (!wasm) {
            throw new Error(
              `MocknetContract ${contract.address} made a non-wasm query:`+
              ` ${JSON.stringify(req)}`
            )
          }
          const { smart } = wasm
          if (!wasm) {
            throw new Error(
              `MocknetContract ${contract.address} made a non-smart wasm query:`+
              ` ${JSON.stringify(req)}`
            )
          }
          if (!contract.backend) {
            throw new Error(
              `MocknetContract ${contract.address} made a query while isolated from`+
              ` the MocknetBackend: ${JSON.stringify(req)}`
            )
          }
          const { contract_addr, callback_code_hash, msg } = smart
          const queried = contract.backend.getInstance(contract_addr)
          if (!queried) {
            throw new Error(
              `MocknetContract ${contract.address} made a query to contract ${contract_addr}` +
              ` which was not found in the MocknetBackend: ${JSON.stringify(req)}`
            )
          }
          const decoded = JSON.parse(b64toUtf8(msg))
          debug(`${bold(contract.address)} queries ${contract_addr}:`, decoded)
          const result = parseResult(queried.query(decoded), 'query_chain', contract_addr)
          debug(`${bold(contract_addr)} responds to ${contract.address}:`, b64toUtf8(result))
          return pass(exports, { Ok: { Ok: result } })
          // https://docs.rs/secret-cosmwasm-std/latest/secret_cosmwasm_std/type.QuerierResult.html
        }
      }
    }
  }
}

MocknetBackend.Contract = MocknetContract

export function parseResult (
  response: { Ok: any, Err: any },
  action:   'instantiate'|'execute'|'query'|'query_chain',
  address?: Fadroma.Address
) {
  const { Ok, Err } = response
  if (Err !== undefined) {
    const errData = JSON.stringify(Err)
    const message = `Mocknet ${action}: contract ${address} returned Err: ${errData}`
    throw Object.assign(new Error(message), Err)
  }
  if (Ok !== undefined) {
    return Ok
  }
  throw new Error(`Mocknet ${action}: contract ${address} returned non-Result type`)
}

/** Read region properties from pointer to region. */
export function region (buffer: Buffer, ptr: Ptr): Region {
  const u32a = new Uint32Array(buffer)
  const addr = u32a[ptr/4+0] // Region.offset
  const size = u32a[ptr/4+1] // Region.capacity
  const used = u32a[ptr/4+2] // Region.length
  return [addr, size, used, u32a]
}
/** Read contents of region referenced by region pointer into a string. */
export function readUtf8 (exports: IOExports, ptr: Ptr): string {
  const { buffer } = exports.memory
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const view = new DataView(buffer, addr, used)
  const data = decoder.decode(view)
  drop(exports, ptr)
  return data
}
/** Read contents of region referenced by region pointer into a string. */
export function readBuffer (exports: IOExports, ptr: Ptr): Buffer {
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
export function pass <T> (exports: IOExports, data: T): Ptr {
  return passBuffer(exports, utf8toBuffer(JSON.stringify(data)))
}
/** Allocate region, write data to it, and return the pointer.
  * See: https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324 */
export function passBuffer (exports: IOExports, buf: Buffer): Ptr {
  const ptr = exports.allocate(buf.length)
  const { buffer } = exports.memory // must be after allocation - see [1]
  const [ addr, _, __, u32a ] = region(buffer, ptr)
  u32a![ptr/4+2] = u32a![ptr/4+1] // set length to capacity
  write(buffer, addr, buf)
  return ptr
}
/** Write data to memory address. */
export function write (buffer: Buffer, addr: number, data: ArrayLike<number>): void {
  new Uint8Array(buffer).set(data, addr)
}
/** Write UTF8-encoded data to memory address. */
export function writeUtf8 (buffer: Buffer, addr: number, data: string): void {
  new Uint8Array(buffer).set(encoder.encode(data), addr)
}
/** Write data to address of region referenced by pointer. */
export function writeToRegion (exports: IOExports, ptr: Ptr, data: ArrayLike<number>): void {
  const [addr, size, _, u32a] = region(exports.memory.buffer, ptr)
  if (data.length > size) { // if data length > Region.capacity
    throw new Error(`Mocknet: tried to write ${data.length} bytes to region of ${size} bytes`)
  }
  const usedPtr = ptr/4+2
  u32a![usedPtr] = data.length // set Region.length
  write(exports.memory.buffer, addr, data)
}
/** Write UTF8-encoded data to address of region referenced by pointer. */
export function writeToRegionUtf8 (exports: IOExports, ptr: Ptr, data: string): void {
  writeToRegion(exports, ptr, encoder.encode(data))
}
/** Deallocate memory. Fails silently if no deallocate callback is exposed by the blob. */
export function drop (exports: IOExports, ptr: Ptr): void {
  if (exports.deallocate) {
    exports.deallocate(ptr)
  } else {
    //console.warn("Can't deallocate", ptr)
  }
}
/** Convert base64 to string */
export function b64toUtf8 (str: string) {
  return Buffer.from(str, 'base64').toString('utf8')
}
/** Convert string to base64 */
export function utf8toB64 (str: string) {
  return Buffer.from(str, 'utf8').toString('base64')
}
export function utf8toBuffer (str: string) {
  return Buffer.from(str, 'utf8')
}
export function bufferToUtf8 (buf: Buffer) {
  return buf.toString('utf8')
}

const codeHashForBlob  = (blob: Uint8Array) => Formati.toHex(new Formati.Sha256(blob).digest())
