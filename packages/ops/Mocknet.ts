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

declare class TextDecoder { decode (_1: any): string }
declare class TextEncoder { encode (_1: string): any }
declare const WebAssembly

import { readFileSync, decode, Console, bold, colors, } from '@hackbg/toolbox'
import { Chain, Agent, Artifact, Template, Instance } from '@fadroma/ops'
import { URL } from 'url'

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
  const ptrOffset  = new Uint32Array(buffer)[ptr/4+0]
  const ptrCapaci  = new Uint32Array(buffer)[ptr/4+1]
  const ptrLength  = new Uint32Array(buffer)[ptr/4+2]
  const uint8Array = new Uint8Array(buffer)
  let end = ptrOffset // loop for null byte
  while (uint8Array[end]) ++end
  const retView = new DataView(buffer, ptrOffset, ptrLength)
  const retData = decoder.decode(retView)
  const retObj = JSON.parse(retData)
  drop(exports, ptr)
  return retObj
}

export function drop (exports, ptr) {
  exports.deallocate(ptr)
}

export class Contract {
  static async load (code, world = {}) {
    const memory = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    const { instance } = await WebAssembly.instantiate(code, { memory, ...world })
    return new this(instance)
  }
  constructor (public readonly instance) {}
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
    return read(this.instance.exports, ptr)
  }
}

export class MocknetState {
  constructor (readonly chain: Mocknet) {}
  codeId    = 0
  uploads   = {}
  contracts = {}
  instances = {}
  makeCallEnv (
    sender,
    address,
    codeHash = this.contracts[address].codeHash,
    now      = + new Date()
  ) {
    const height     = Math.floor(now/5000)
    const time       = Math.floor(now/1000)
    const chain_id   = this.chain.id
    const sent_funds = []
    return {
      block:    { height, time, chain_id },
      message:  { sender, sent_funds },
      contract: { address },
      contract_key: "",
      contract_code_hash: codeHash
    }
  }
  makeContractEnv () {
    return {
      db_read              (...args:any) { console.debug('db_read',     args) },
      db_write             (...args:any) { console.debug('db_write',    args) },
      db_remove            (...args:any) { console.debug('db_remove',   args) },
      canonicalize_address (...args:any) { console.debug('canonize',    args) },
      humanize_address     (...args:any) { console.debug('humanize',    args) },
      query_chain          (...args:any) { console.debug('query_chain', args) }
    }
  }
  makeCodeId () {
    return ++this.codeId
  }
}

export class Mocknet extends Chain {
  id    = 'fadroma-mocknet'
  Agent = MockAgent
  state = new MocknetState(this)
  async getAgent ({ name }) {
    return new MockAgent(this, name)
  }
  assertContractExists (address: string) {
    if (!this.state.contracts[address]) {
      throw new Error(`No contract at ${address}`)
    }
  }
  upload ({ location, codeHash }: Artifact): Template {
    const codeId  = this.state.makeCodeId()
    const content = this.state.uploads[codeId] = readFileSync(location)
    return {
      chainId: this.id,
      codeId:  String(codeId),
      codeHash
    }
  }
  getCodeById (codeId) {
    const code = this.state.uploads[codeId]
    if (!code) {
      throw new Error(`No code with id ${codeId}`)
    }
    return code
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

  async upload (artifact: Artifact): Promise<Template> {
    return this.chain.upload(artifact)
  }

  Bundle = null

  async doInstantiate ({ codeId, codeHash }: Template, label, msg, funds = []): Promise<Instance> {
    const code     = this.chain.getCodeById(codeId)
    const address  = `mocknet1${Math.floor(Math.random()*1000000)}`
    const contract = await Contract.load(code, { env: this.chain.state.makeContractEnv() })
    const response = contract.init(this.chain.state.makeCallEnv(this.address, address, codeHash), msg)
    if (response.Err) {
      console.error(colors.red(bold('Contract returned error: '))+JSON.stringify(response.Err))
      throw 'TODO error handling'
    } else {
      this.chain.state.instances[address] = contract
    }
    return {
      chainId: this.chain.id,
      codeId,
      codeHash,
      address,
      label
    }
  }

  doQuery ({ address }: Instance, msg: any) {
    this.chain.assertContractExists(address)
    const codeId = this.chain.state.contracts[address]
    const code   = this.chain.state.uploads[codeId]
    console.log(code)
    return Promise.resolve({})
  }

  doExecute ({ address }: Instance, msg: any, _3: any, _4?: any, _5?: any) {
    this.chain.assertContractExists(address)
    return Promise.resolve({})
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
