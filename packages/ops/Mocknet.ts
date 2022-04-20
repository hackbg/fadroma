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

import { readFileSync, decode, Console, bold, colors, } from '@hackbg/toolbox'
import { Chain, Agent, Artifact, Template, Instance, Identity } from '@fadroma/ops'
import { URL } from 'url'

declare class TextDecoder {
  decode (data: any): string
}

declare class TextEncoder {
  encode (data: string): any
}

declare namespace WebAssembly {
  class Memory { constructor ({ initial, maximum }) }
  class Instance<T> { exports: T }
  function instantiate (code, world)
}

type Ptr = number

export interface ContractExports {
  memory: WebAssembly.Memory
  init   (env: Ptr, msg: Ptr): Ptr
  handle (env: Ptr, msg: Ptr): Ptr
  query  (msg: Ptr): Ptr
}

export interface ContractImports {
  memory: WebAssembly.Memory
  env: {
    db_read              (key: Ptr): Ptr
    db_write             (key: Ptr, val: Ptr)
    db_remove            (key: Ptr)
    canonicalize_address (src: Ptr, dst: Ptr): Ptr
    humanize_address     (src: Ptr, dst: Ptr): Ptr
    query_chain          (req: Ptr): Ptr
  }
}

const console = Console('@fadroma/mocknet')
const decoder = new TextDecoder()
const encoder = new TextEncoder()

/** [1] https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324 */
export function pass (exports, data) {
  const dataString = JSON.stringify(data)
  const dataBufPtr = exports.allocate(dataString.length)
  const { buffer } = exports.memory // must be after allocation - see [1]
  const u32a = new Uint32Array(buffer)
  const dataOffset = u32a[dataBufPtr/4+0]
  const dataCapaci = u32a[dataBufPtr/4+1]
  const dataLength = u32a[dataBufPtr/4+2]
  u32a[dataBufPtr/4+2] = u32a[dataBufPtr/4+1] // set length to capacity
  const dataBinStr = encoder.encode(dataString)
  new Uint8Array(buffer).set(dataBinStr, dataOffset)
  return dataBufPtr
}

export function read (exports, ptr) {
  const { buffer } = exports.memory
  const u32a = new Uint32Array(buffer)
  const ptrOffset = u32a[ptr/4+0]
  const ptrCapaci = u32a[ptr/4+1]
  const ptrLength = u32a[ptr/4+2]
  const uint8Array = new Uint8Array(buffer)
  const retView = new DataView(buffer, ptrOffset, ptrLength)
  const retData = decoder.decode(retView)
  drop(exports, ptr)
  return retData
}

export function drop (exports, ptr) {
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
    const envBuf = this.pass(env)
    const msgBuf = this.pass(msg)
    const retPtr = this.instance.exports.init(envBuf, msgBuf)
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
  makeImports (): ContractImports {
    const memory = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    return {
      memory,
      env: {
        db_read (keyPtr): Ptr {
          const key = read({ memory }, keyPtr)
          console.info('db_read', { key })
          return 0
        },
        db_write (keyPtr, valPtr) {
          const key = read({ memory }, keyPtr)
          const val = read({ memory }, valPtr)
          console.info('db_write', { key, val })
        },
        db_remove (keyPtr) {
          const key = read({ memory }, keyPtr)
          console.info('db_remove', { key })
        },
        canonicalize_address (srcPtr, dstPtr) {
          const src = read({ memory }, srcPtr)
          const dst = read({ memory }, dstPtr)
          console.info('canonize', { src, dst })
          return 0
        },
        humanize_address (srcPtr, dstPtr) {
          const src = read({ memory }, srcPtr)
          const dst = read({ memory }, dstPtr)
          console.info('humanize', { src, dst })
          return 0
        },
        query_chain (reqPtr) {
          const req = read({ memory }, reqPtr)
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
    const address  = `mocknet1${Math.floor(Math.random()*1000000)}`
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
    const contract = this.getInstance(address)
    return Promise.resolve({
      transactionHash: "",
      logs: [],
      data: null
    })
  }
  async query ({ address, codeHash }: Instance, msg) {
    const contract = this.getInstance(address)
    return Promise.resolve({})
  }
}

export class Mocknet extends Chain {
  constructor (id = 'fadroma-mocknet', options = {}) {
    super(id, options)
  }
  Agent = MockAgent
  state = new MocknetState(this.id)
  async getAgent ({ name }: Identity = {}) {
    return new MockAgent(this, name)
  }
}

export class MockAgent extends Agent {

  static async create (chain: Mocknet) { return new MockAgent(chain, 'MockAgent') }

  constructor (readonly chain: Mocknet, readonly name: string = 'mock') {
    super()
    this.address = this.name
  }

  address: string

  defaultDenomination = 'umock'

  async upload (artifact) {
    return this.chain.state.upload(artifact)
  }

  Bundle = null

  async doInstantiate (template, label, msg, funds = []): Promise<Instance> {
    return await this.chain.state.instantiate(this.address, template, label, msg, funds)
  }

  async doExecute (instance, msg, funds, memo?, fee?) {
    return await this.chain.state.execute(this.address, instance, msg, funds, memo, fee)
  }

  async doQuery (instance, msg) {
    return await this.chain.state.query(instance, msg)
  }

  get nextBlock () {
    return Promise.resolve()
  }

  get block () {
    return Promise.resolve(0)
  }

  get account () {
    return Promise.resolve()
  }

  get balance () {
    return Promise.resolve(0)
  }

  getBalance (_: string) {
    return Promise.resolve(0)
  }

  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any) {
    return Promise.resolve()
  }

  sendMany (_1:any, _2:any, _3?:any, _4?:any) {
    return Promise.resolve()
  }

  getCodeHash (_: any) {
    return Promise.resolve("SomeCodeHash")
  }

  getCodeId (_: any) {
    return Promise.resolve(1)
  }

  getLabel (_: any) {
    return Promise.resolve("SomeLabel")
  }

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
