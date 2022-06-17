/*
Fadroma Mocknet
Copyright (C) 2022 Hack.bg

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { Console, bold } from '@hackbg/konzola'
import { randomBech32, bech32 } from '@hackbg/formati'

import {
  Address,
  Agent,
  AgentOpts,
  Bundle,
  Chain,
  ChainMode,
  Template,
  Instance
} from '@fadroma/client'

import { codeHashForBlob } from './Build'

const console = Console('Fadroma Mocknet')
const decoder = new TextDecoder()
const encoder = new TextEncoder()

declare class TextDecoder {
  decode (data: any): string
}

declare class TextEncoder {
  encode (data: string): any
}

declare namespace WebAssembly {
  class Memory {
    constructor ({ initial, maximum })
    buffer: Buffer
  }
  class Instance<T> { exports: T }
  function instantiate (code, world)
}

export type Ptr     = number

export type Size    = number

export type ErrCode = number

/** Memory region as allocated by CosmWasm */
export type Region = [Ptr, Size, Size, Uint32Array?]

export interface IOExports {
  memory: WebAssembly.Memory
  allocate (len: Size): Ptr
}

export interface ContractExports extends IOExports {
  init   (env: Ptr, msg: Ptr): Ptr
  handle (env: Ptr, msg: Ptr): Ptr
  query  (msg: Ptr):           Ptr
}

export interface ContractImports {
  memory: WebAssembly.Memory
  env: {
    db_read              (key: Ptr): Ptr
    db_write             (key: Ptr, val: Ptr)
    db_remove            (key: Ptr)
    canonicalize_address (src: Ptr, dst: Ptr): ErrCode
    humanize_address     (src: Ptr, dst: Ptr): ErrCode
    query_chain          (req: Ptr): Ptr
  }
}

export const MOCKNET_ADDRESS_PREFIX = 'mocked'

// TODO move this env var to global config
const trace = process.env.FADROMA_MOCKNET_DEBUG ? ((...args) => {
  console.info(...args)
  console.log()
}) : (...args) => {}
const debug = process.env.FADROMA_MOCKNET_DEBUG ? ((...args) => {
  console.debug(...args)
  console.log()
}) : (...args) => {}

/** Chain instance containing a local MocknetBackend. */
export class Mocknet extends Chain {
  defaultDenom = 'umock'
  constructor (id = 'fadroma-mocknet', options = {}) {
    super(id, { ...options, mode: ChainMode.Mocknet })
  }
  Agent = MocknetAgent
  backend = new MocknetBackend(this.id)
  async getAgent (options: AgentOpts) {
    return new MocknetAgent(this, options)
  }
  async query <T, U> (contract: Instance, msg: T): Promise<U> {
    return this.backend.query(contract, msg)
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
}

/** Agent instance calling its Chain's Mocknet backend. */
export class MocknetAgent extends Agent {
  get defaultDenom () { return this.chain.defaultDenom }
  Bundle = MocknetBundle
  static async create (chain: Mocknet, options: AgentOpts) {
    return new MocknetAgent(chain, options)
  }
  constructor (readonly chain: Mocknet, readonly options: AgentOpts) {
    super(chain, options)
  }
  name:    string  = 'MocknetAgent'
  address: Address = randomBech32(MOCKNET_ADDRESS_PREFIX)
  async upload (blob: Uint8Array) {
    return this.chain.backend.upload(blob)
  }
  async instantiate (template, label, msg, funds = []): Promise<Instance> {
    return await this.chain.backend.instantiate(
      this.address, template, label, msg, funds
    )
  }
  async execute <M, R> (instance, msg: M, opts): Promise<R> {
    return await this.chain.backend.execute(
      this.address, instance, msg, opts.funds, opts.memo, opts.fee
    )
  }
  async query <M, R> (instance, msg: M): Promise<R> {
    return await this.chain.query(instance, msg)
  }
  get nextBlock () { return Promise.resolve(0)   }
  get block     () { return Promise.resolve(0)   }
  get account   () { return Promise.resolve()    }
  get balance   () { return Promise.resolve("0") }
  getBalance (_: string) { return Promise.resolve("0") }
  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any) { return Promise.resolve() }
  sendMany (_1:any, _2:any, _3?:any, _4?:any) { return Promise.resolve() }
}

export class MocknetBundle extends Bundle {

  declare agent: MocknetAgent

  async submit (memo = "") {
    const results = []
    for (const { init, exec } of this.msgs) {
      if (init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        results.push(await this.agent.instantiate({ codeId, codeHash }, label, msg, funds))
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

/** Hosts MocknetContract instances. */
export class MocknetBackend {

  constructor (readonly chainId: string) {}

  codeId  = 0

  uploads = {}

  getCode (codeId) {
    const code = this.uploads[codeId]
    if (!code) {
      throw new Error(`No code with id ${codeId}`)
    }
    return code
  }

  upload (blob: Uint8Array): Template {
    const chainId  = this.chainId
    const codeId   = ++this.codeId
    const content  = this.uploads[codeId] = blob
    const codeHash = codeHashForBlob(blob)
    return { chainId, codeId: String(codeId), codeHash }
  }

  instances = {}

  getInstance (address) {
    const instance = this.instances[address]
    if (!instance) {
      throw new Error(`MocknetBackend#getInstance: no contract at ${address}`)
    }
    return instance
  }

  async instantiate (
    sender: Address, { codeId, codeHash }: Template, label, msg, funds = []
  ): Promise<Instance> {
    const chainId  = this.chainId
    const code     = this.getCode(codeId)
    const contract = await new MocknetContract(this).load(code)
    const env      = this.makeEnv(sender, contract.address, codeHash)
    const response = contract.init(env, msg)
    const initResponse = parseResult(response, 'instantiate', contract.address)
    this.instances[contract.address] = contract
    await this.passCallbacks(contract.address, initResponse.messages)
    return { chainId, codeId, codeHash, address: contract.address, label }
  }

  async execute (sender: string, { address, codeHash }: Instance, msg, funds, memo?, fee?) {
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
    sender,
    address,
    codeHash = this.instances[address].codeHash,
    now      = + new Date()
  ) {
    const height     = Math.floor(now/5000)
    const time       = Math.floor(now/1000)
    const chain_id   = this.chainId
    const sent_funds = []
    return {
      block:    { height, time, chain_id },
      message:  { sender, sent_funds },
      contract: { address },
      contract_key: "",
      contract_code_hash: codeHash
    }
  }

  async passCallbacks (sender: Address, messages: Array<any>) {
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
          { codeId: code_id, codeHash: callback_code_hash },
          label,
          JSON.parse(b64toUtf8(msg)),
          send
        )
        trace(
          `Callback from ${bold(sender)}: instantiated contract`, bold(label),
          'from code id', bold(code_id), 'with hash', bold(callback_code_hash),
          'at address', bold(instance.address)
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

  async query ({ address, codeHash }: Instance, msg) {
    const result = b64toUtf8(parseResult(this.getInstance(address).query(msg), 'query', address))
    return JSON.parse(result)
  }

  private resultOf (address: Address, action: string, response: any) {
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

}

export function parseResult (response: any, address: Address, action: string) {
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

/** Hosts a WASM contract blob and contains the contract-local storage. */
export class MocknetContract {
  constructor (
    readonly backend: MocknetBackend|null = null,
    readonly address: Address             = randomBech32(MOCKNET_ADDRESS_PREFIX)
  ) {
    trace('Instantiating', bold(address))
  }
  instance: WebAssembly.Instance<ContractExports>
  async load (code) {
    const { instance } = await WebAssembly.instantiate(code, this.makeImports())
    this.instance = instance
    return this
  }
  init (env, msg) {
    debug(`${bold(this.address)} init:`, msg)
    try {
      const envBuf  = this.pass(env)
      const msgBuf  = this.pass(msg)
      const retPtr  = this.instance.exports.init(envBuf, msgBuf)
      const retData = this.readUtf8(retPtr)
      return retData
    } catch (e) {
      console.error(bold(this.address), `crashed on init:`, e.message)
      throw e
    }
  }
  handle (env, msg) {
    debug(`${bold(this.address)} handle:`, msg)
    try {
      const envBuf = this.pass(env)
      const msgBuf = this.pass(msg)
      const retPtr = this.instance.exports.handle(envBuf, msgBuf)
      const retBuf = this.readUtf8(retPtr)
      return retBuf
    } catch (e) {
      console.error(bold(this.address), `crashed on handle:`, e.message)
      throw e
    }
  }
  query (msg) {
    debug(`${bold(this.address)} query:`, msg)
    try {
      const msgBuf = this.pass(msg)
      const retPtr = this.instance.exports.query(msgBuf)
      const retBuf = this.readUtf8(retPtr)
      return retBuf
    } catch (e) {
      console.error(bold(this.address), `crashed on query:`, e.message)
      throw e
    }
  }
  private pass (data) {
    return pass(this.instance.exports, data)
  }
  private readUtf8 (ptr) {
    return JSON.parse(readUtf8(this.instance.exports, ptr))
  }
  storage = new Map<string, Buffer>()
  makeImports (): ContractImports {
    // don't destructure - when first instantiating the
    // contract, `this.instance` is still undefined
    const contract = this
    // initial blank memory
    const memory   = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    // when reentering, get the latest memory
    const getExports = () => ({
      memory:   contract.instance.exports.memory,
      allocate: contract.instance.exports.allocate,
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
            return passBuffer(exports, val)
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
          const canon   = bech32.fromWords(bech32.decode(human).words)
          const dst     = region(exports.memory.buffer, dstPtr)
          trace(bold(contract.address), `canonize:`, human, '->', `${canon}`)
          writeToRegion(exports, dstPtr, canon)
          return 0
        },
        humanize_address (srcPtr, dstPtr) {
          const exports = getExports()
          const canon   = readBuffer(exports, srcPtr)
          const human   = bech32.encode(MOCKNET_ADDRESS_PREFIX, bech32.toWords(canon))
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
          return pass(exports, { Ok: { Ok: result } }) // https://docs.rs/secret-cosmwasm-std/latest/secret_cosmwasm_std/type.QuerierResult.html
        }
      }
    }
  }
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
  u32a[ptr/4+2] = u32a[ptr/4+1] // set length to capacity
  write(buffer, addr, buf)
  return ptr
}

/** Write data to memory address. */
export function write (buffer: Buffer, addr, data: ArrayLike<number>): void {
  new Uint8Array(buffer).set(data, addr)
}

/** Write UTF8-encoded data to memory address. */
export function writeUtf8 (buffer: Buffer, addr, data: string): void {
  new Uint8Array(buffer).set(encoder.encode(data), addr)
}

/** Write data to address of region referenced by pointer. */
export function writeToRegion (exports: IOExports, ptr: Ptr, data: ArrayLike<number>): void {
  const [addr, size, _, u32a] = region(exports.memory.buffer, ptr)
  if (data.length > size) { // if data length > Region.capacity
    throw new Error(`Mocknet: tried to write ${data.length} bytes to region of ${size} bytes`)
  }
  const usedPtr = ptr/4+2
  u32a[usedPtr] = data.length // set Region.length
  write(exports.memory.buffer, addr, data)
}

/** Write UTF8-encoded data to address of region referenced by pointer. */
export function writeToRegionUtf8 (exports: IOExports, ptr: Ptr, data: string): void {
  writeToRegion(exports, ptr, encoder.encode(data))
}

/** Deallocate memory. Fails silently if no deallocate callback is exposed by the blob. */
export function drop (exports, ptr): void {
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
