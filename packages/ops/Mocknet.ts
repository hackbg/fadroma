import {
  readFileSync, decode, Console, bold, colors,
} from '@hackbg/tools'

import {
  Chain, Agent, Artifact, Template, Instance
} from '@fadroma/ops'

//import WASMFFI from 'wasm-ffi'
import { URL } from 'url'

const console = Console('@fadroma/mocknet')

export class Mocknet extends Chain {
  id    = 'Mocknet'
  Agent = MockAgent
  mock = {
    codeId:    0,
    uploads:   {},
    contracts: {},
    instances: {},
    env: () => ({
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
  constructor (
    readonly chain: Mocknet,
    readonly name:  string = 'mock'
  ) {
    super()
    this.address = this.name
  }
  address: string
  defaultDenomination = 'umock'
  async upload (artifact: Artifact): Promise<Template> {
    const codeId  = ++this.chain.mock.codeId
    const content = this.chain.mock.uploads[codeId] = readFileSync(artifact.location)
    return {
      chainId: this.chain.id,
      codeId:  String(codeId)
    }
  }
  Bundle = null
  async doInstantiate ({ codeId }: Template, label, msg, funds = []): Promise<Instance> {
    const content = this.chain.mock.uploads[codeId]
    if (!content) {
      throw new Error(`No code with id ${codeId}`)
    }
    const address = `mocknet1${Math.floor(Math.random()*1000000)}`
    const strptr = () => 'u32'
    const instance = this.chain.mock.instances[address] = new WASMFFI.Wrapper({
      init:   [InitResponse,   [Env, strptr()]],
      handle: [HandleResponse, [Env, strptr()]],
      query:  [QueryResponse,  [strptr()]]
    }).use((await WebAssembly.instantiate(content, { env: this.chain.mock.env() })).instance)
    const env_ptr = new WASMFFI.StringPointer('{}')
    instance.utils.allocate(env_ptr)
    const msg_ptr = new WASMFFI.StringPointer('{}')
    instance.utils.allocate(msg_ptr)
    const response = JSON.parse(
      decode(
        Uint8Array.from(
          instance.init(
            env_ptr.ref(),
            msg_ptr.ref()
          ).values
        ).buffer as Buffer
      )
    )

    if (response.Err) {
      console.error(colors.red(bold('Contract returned error: '))+JSON.stringify(response.Err))
    } else {
      console.info(JSON.stringify(response))
    }
    throw new Error('TODO')
    return {
      chainId: this.chain.id,
      codeId,
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
      const id = 'mocknet'
      return new Mocknet(id, {
        apiURL:    new URL('mock://mock:0'),
        statePath: `/tmp/fadroma_mocknet_${Math.floor(Math.random()*1000000)}`
      })
    }
  }

}

//const { Struct, StringPointer, rust: { vector: Vector } } = WASMFFI

//const Coin = new Struct({
  //denom:  'string',
  //amount: 'string'
//})

//const BlockInfo = new Struct({
  //height: 'u64',
  //time:   'u64'
//})

//const MessageInfo  = new Struct({
  //sender:     'string',
  //sent_funds: Vector(Coin)
//})

//const ContractInfo = new Struct({
  //address: 'string'
//})

//const Env = new Struct({
  //block:    BlockInfo,
  //message:  MessageInfo,
  //contract: ContractInfo
//})

//const InitResponse   = Vector('u8')

//const HandleResponse = Vector('u8')

//const QueryResponse  = Vector('u8')
