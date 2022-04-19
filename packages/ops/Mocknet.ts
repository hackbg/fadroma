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
import { Chain, Agent, Artifact, Template, Instance } from '@fadroma/ops'
import { URL } from 'url'

const console = Console('@fadroma/mocknet')

const decoder = new TextDecoder()
const encoder = new TextEncoder()

export class Contract {
  static async load (code) {
    const memory = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    const { instance } = await WebAssembly.instantiate(code, { memory })
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
  /** [1] https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324 */
  private pass (data) {
    const dataString = JSON.stringify(data)
    const dataBufPtr = this.instance.exports.allocate(dataString.length)
    const { buffer } = this.instance.exports.memory // must be after allocation - see [1]
    const u32a = new Uint32Array(buffer)
    const dataOffset = u32a[dataBufPtr/4+0]
    const dataCapaci = u32a[dataBufPtr/4+1]
    const dataLength = u32a[dataBufPtr/4+2]
    u32a[dataBufPtr/4+2] = u32a[dataBufPtr/4+1] // set length to capacity
    const dataBinStr = encoder.encode(dataString)
    new Uint8Array(buffer).set(dataBinStr, dataOffset)
    return dataBufPtr
  }
  private read (ptr) {
    const { buffer } = this.instance.exports.memory
    const ptrOffset  = new Uint32Array(buffer)[ptr/4+0]
    const ptrCapaci  = new Uint32Array(buffer)[ptr/4+1]
    const ptrLength  = new Uint32Array(buffer)[ptr/4+2]
    const uint8Array = new Uint8Array(buffer)
    let end = ptrOffset // loop for null byte
    while (uint8Array[end]) ++end
    const retView = new DataView(buffer, ptrOffset, ptrLength)
    const retData = decoder.decode(retView)
    const retObj = JSON.parse(retData)
    this.drop(ptr)
    return retObj
  }
  private drop (ptr) {
    this.instance.exports.deallocate(ptr)
  }
}

export class Mocknet extends Chain {
  id    = 'fadroma-mocknet'
  Agent = MockAgent
  mock  = {
    codeId:    0,
    uploads:   {},
    contracts: {},
    instances: {},
    env: (
      senderAddress,
      contractAddress,
      codeHash = this.mock.contracts[contractAddress].codeHash,
      now      = + new Date()
    ) => ({
      block: {
        height:   Math.floor(now/5000),
        time:     Math.floor(now/1000),
        chain_id: "mock"
      },
      message: {
        sender: senderAddress,
        sent_funds: []
      },
      contract: {
        address: contractAddress
      },
      contract_key: "",
      contract_code_hash: codeHash
    }),
    world: () => ({
      db_read              (...args:any) { console.debug('db_read',     args) },
      db_write             (...args:any) { console.debug('db_write',    args) },
      db_remove            (...args:any) { console.debug('db_remove',   args) },
      canonicalize_address (...args:any) { console.debug('canonize',    args) },
      humanize_address     (...args:any) { console.debug('humanize',    args) },
      query_chain          (...args:any) { console.debug('query_chain', args) }
    })
  }
  setStateDirs ({ statePath }) {}
  async getAgent (name: string) { return new MockAgent(this, name) }
  assertContractExists (address: string) {
    if (!this.mock.contracts[address]) {
      throw new Error(`No contract at ${address}`)
    }
  }
}

export class MockAgent extends Agent {

  static create (chain: Mocknet) { return new MockAgent(chain, 'MockAgent') }

  constructor (readonly chain: Mocknet, readonly name: string = 'mock') {
    super()
    this.address = this.name
  }

  address: string

  defaultDenomination = 'umock'

  async upload ({ location, codeHash }: Artifact): Promise<Template> {
    const codeId  = ++this.chain.mock.codeId
    const content = this.chain.mock.uploads[codeId] = readFileSync(location)
    return {
      chainId: this.chain.id,
      codeId:  String(codeId),
      codeHash
    }
  }

  Bundle = null

  async doInstantiate ({ codeId, codeHash }: Template, label, msg, funds = []): Promise<Instance> {
    const { mock } = this.chain
    const code = mock.uploads[codeId]
    if (!code) {
      throw new Error(`No code with id ${codeId}`)
    }
    const address  = `mocknet1${Math.floor(Math.random()*1000000)}`
    const contract = await Contract.load(code)
    const response = contract.init(mock.env(this.address, address, codeHash), msg)
    if (response.Err) {
      console.error(colors.red(bold('Contract returned error: '))+JSON.stringify(response.Err))
      throw 'TODO error handling'
    } else {
      mock.instances[address] = contract
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
    const codeId = this.chain.mock.contracts[address]
    const code = this.chain.mock.uploads[codeId]
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
