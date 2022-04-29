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

import { readFileSync, decode, Console, bold, colors, randomBech32, bech32 } from '@hackbg/toolbox'
import { Chain, Agent, AgentOptions } from '@fadroma/client'
import { Artifact, Template, Instance } from '@fadroma/ops'
import { URL } from 'url'

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

type Ptr     = number
type Size    = number
type ErrCode = number

export interface IOExports {
  memory: WebAssembly.Memory
  allocate (len: Size): Ptr
}

export interface ContractExports extends IOExports {
  init     (env: Ptr, msg: Ptr): Ptr
  handle   (env: Ptr, msg: Ptr): Ptr
  query    (msg: Ptr):           Ptr
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

const console = Console('@fadroma/mocknet')
const decoder = new TextDecoder()
const encoder = new TextEncoder()

export type Region = [Ptr, Size, Size, Uint32Array?]

export function region (buffer: Buffer, ptr: Ptr): Region {
  const u32a = new Uint32Array(buffer)
  const addr = u32a[ptr/4+0] // Region.offset
  const size = u32a[ptr/4+1] // Region.capacity
  const used = u32a[ptr/4+2] // Region.length
  return [addr, size, used, u32a]
}

export function read (exports: IOExports, ptr: Ptr): string {
  const { buffer } = exports.memory
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const view = new DataView(buffer, addr, used)
  const data = decoder.decode(view)
  drop(exports, ptr)
  return data
}

/** [1] https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324 */
export function pass <T> (exports: IOExports, data: T): Ptr {
  const str = JSON.stringify(data)
  const ptr = exports.allocate(str.length)
  const { buffer } = exports.memory // must be after allocation - see [1]
  const [ addr, _, __, u32a ] = region(buffer, ptr)
  u32a[ptr/4+2] = u32a[ptr/4+1] // set length to capacity
  writeUtf8(buffer, addr, str)
  return ptr
}

export function write (buffer: Buffer, addr, data: ArrayLike<number>): void {
  new Uint8Array(buffer).set(data, addr)
}

export function writeUtf8 (buffer: Buffer, addr, data: string): void {
  new Uint8Array(buffer).set(encoder.encode(data), addr)
}

export function writeToRegion (exports: IOExports, ptr: Ptr, data: ArrayLike<number>): void {
  const [addr, size, _, u32a] = region(exports.memory.buffer, ptr)
  if (data.length > size) { // if data length > Region.capacity
    throw new Error(`Mocknet: tried to write ${data.length} bytes to region of ${size} bytes`)
  }
  const usedPtr = ptr/4+2
  u32a[usedPtr] = data.length // set Region.length
  write(exports.memory.buffer, addr, data)
}

export function writeToRegionUtf8 (exports: IOExports, ptr: Ptr, data: string): void {
  writeToRegion(exports, ptr, encoder.encode(data))
}

export function drop (exports, ptr): void {
  if (exports.deallocate) {
    exports.deallocate(ptr)
  } else {
    //console.warn("Can't deallocate", ptr)
  }
}

export class Contract {
  instance: WebAssembly.Instance<ContractExports>
  async load (code) {
    const { instance } = await WebAssembly.instantiate(code, this.makeImports())
    this.instance = instance
    return this
  }
  init (env, msg) {
    const envBuf  = this.pass(env)
    const msgBuf  = this.pass(msg)
    const retPtr  = this.instance.exports.init(envBuf, msgBuf)
    const retData = this.read(retPtr)
    return retData
  }
  handle (env, msg) {
    const envBuf = this.pass(env)
    const msgBuf = this.pass(msg)
    const retPtr = this.instance.exports.handle(envBuf, msgBuf)
    const retBuf = this.read(retPtr)
    return retBuf
  }
  query (msg) {
    const msgBuf = this.pass(msg)
    const retPtr = this.instance.exports.query(msgBuf)
    const retBuf = this.read(retPtr)
    return retBuf
  }
  private pass (data) {
    return pass(this.instance.exports, data)
  }
  private read (ptr) {
    return JSON.parse(read(this.instance.exports, ptr))
  }
  storage = new Map()
  makeImports (): ContractImports {
    // don't destructure - when first instantiating the
    // contract, `this.instance` is still undefined
    const contract = this
    // initial blank memory
    const memory   = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    // when reentering, get the latest memory
    const getExports = () => ({
      memory:     contract.instance.exports.memory,
      allocate:   contract.instance.exports.allocate,
    })
    return {
      memory,
      env: {
        db_read (keyPtr) {
          const exports = getExports()
          const key     = read(exports, keyPtr)
          const val     = contract.storage.get(key)
          console.info(`db_read:  ${key} = ${val}`)
          if (contract.storage.has(key)) {
            return pass(exports, val)
          } else {
            return 0
          }
        },
        db_write (keyPtr, valPtr) {
          const exports = getExports()
          const key     = read(exports, keyPtr)
          const val     = read(exports, valPtr)
          contract.storage.set(key, val)
          console.info(`db_write: ${key} = ${val}`)
        },
        db_remove (keyPtr) {
          const exports = getExports()
          const key     = read(exports, keyPtr)
          console.info(`db_remove: ${key}`)
          contract.storage.delete(key)
        },
        canonicalize_address (srcPtr, dstPtr) {
          const exports = getExports()
          const human   = read(exports, srcPtr)
          const canon   = bech32.fromWords(bech32.decode(human).words)
          const dst     = region(exports.memory.buffer, dstPtr)
          console.info(`canonize:`, human, '->', `${canon}`)
          writeToRegion(exports, dstPtr, canon)
          return 0
        },
        humanize_address (srcPtr, dstPtr) {
          const exports = getExports()
          const canon   = read(exports, srcPtr)
          const human   = Buffer.from(canon).toString("utf8")
          const dst     = region(exports.memory.buffer, dstPtr)
          console.info(`humanize:`, canon, '->', human)
          writeToRegionUtf8(exports, dstPtr, human)
          return 0
        },
        query_chain (reqPtr) {
          console.log('query')
          const exports = getExports()
          const req     = read(exports, reqPtr)
          console.info('query_chain', { req })
          return 0
        }
      }
    }
  }
}

export class MocknetState {
  constructor (readonly chainId: string) {}
  codeId    = 0
  uploads   = {}
  instances = {}
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
  upload ({ location, codeHash }: Artifact): Template {
    const chainId = this.chainId
    const codeId  = ++this.codeId
    const content = this.uploads[codeId] = readFileSync(location)
    return { chainId, codeId: String(codeId), codeHash }
  }
  getCode (codeId) {
    const code = this.uploads[codeId]
    if (!code) {
      throw new Error(`No code with id ${codeId}`)
    }
    return code
  }
  async instantiate (
    sender: string, { codeId, codeHash }: Template, label, msg, funds = []
  ): Promise<Instance> {
    const chainId  = this.chainId
    const code     = this.getCode(codeId)
    const address  = randomBech32('mocked')
    const contract = await new Contract().load(code)
    const env      = this.makeEnv(sender, address, codeHash)
    const response = contract.init(env, msg)
    if (response.Err) {
      console.error(colors.red(bold('Contract returned error: '))+JSON.stringify(response.Err))
      throw 'TODO error handling'
    } else {
      this.instances[address] = contract
    }
    return { chainId, codeId, codeHash, address, label }
  }
  getInstance (address) {
    const instance = this.instances[address]
    if (!instance) {
      throw new Error(`Mocknet: no contract at ${address}`)
    }
    return instance
  }
  async execute (sender: string, { address, codeHash }: Instance, msg, funds, memo, fee) {
    return this.resultOf(this.getInstance(address).handle(this.makeEnv(sender, address), msg))
  }
  async query ({ address, codeHash }: Instance, msg) {
    return this.resultOf(this.getInstance(address).query(msg))
  }
  private resultOf (result) {
    if (result.Ok) {
      return result.Ok
    } else if (result.Err) {
      const msg = `Mocknet: contract returned error: ${JSON.stringify(result.Err)}`
      const err = Object.assign(new Error(msg), { Err: result.Err })
      throw err
    } else {
      const msg = 'Mocknet: contract returned non-Result type'
      const err = Object.assign(new Error(msg), { result })
      throw err
    }
  }
}

export class Mocknet extends Chain {
  constructor (id = 'fadroma-mocknet', options = {}) {
    super(id, options)
  }
  Agent = MockAgent
  state = new MocknetState(this.id)
  async getAgent ({ name }: MockAgentOptions = {}) {
    return new MockAgent(this, name)
  }
}

export interface MockAgentOptions extends AgentOptions {}

export class MockAgent extends Agent {

  defaultDenomination = 'umock'

  Bundle = null

  static async create (chain: Mocknet) { return new MockAgent(chain, { name: 'MockAgent' }) }

  constructor (readonly chain: Mocknet, readonly options: MockAgentOptions) {
    super(chain, options)
    this.address = this.name
  }

  address: string

  async upload (artifact) {
    return this.chain.state.upload(artifact)
  }

  async doInstantiate (template, label, msg, funds = []): Promise<Instance> {
    return await this.chain.state.instantiate(this.address, template, label, msg, funds)
  }
  async doExecute (instance, msg, funds, memo?, fee?) {
    return await this.chain.state.execute(this.address, instance, msg, funds, memo, fee)
  }
  async doQuery (instance, msg) {
    return await this.chain.state.query(instance, msg)
  }

  get nextBlock () { return Promise.resolve()   }
  get block     () { return Promise.resolve(0)  }
  get account   () { return Promise.resolve()   }
  get balance   () { return Promise.resolve(0n) }

  send        (_1:any, _2:any, _3?:any, _4?:any, _5?:any) { return Promise.resolve() }
  sendMany    (_1:any, _2:any, _3?:any, _4?:any)          { return Promise.resolve() }

  getBalance (_: string) { return Promise.resolve(0n)             }
  getHash    (_: any)    { return Promise.resolve("SomeCodeHash") }
  getCodeId  (_: any)    { return Promise.resolve("1")            }
  getLabel   (_: any)    { return Promise.resolve("SomeLabel")    }

}

export const Mocks = {

  Agent: MockAgent,

  Chains: {
    Mocknet () {
      const id = 'fadroma-mocknet'
      return new Mocknet(id, {
        apiURL:    new URL('mock://mock:0'),
        statePath: `/tmp/fadroma_mocknet_${Math.floor(Math.random()*1000000)}`
      })
    }
  }

}
