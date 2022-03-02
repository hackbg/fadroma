import { Chain } from './Chain'
import { Agent } from './Agent'
import type { Contract } from './Contract'
import { Directory, readFileSync, decode, Console, bold, colors } from '@hackbg/tools'
import { URL } from 'url'
import WASMFFI from 'wasm-ffi'

const console = Console('@fadroma/ops/Mock')

export class Mocknet extends Chain {
  id         = 'mocknet'
  isDevnet = true
  apiURL     = new URL('mock://mock:0')
  stateRoot  = new Directory(`/tmp/fadroma_mocknet_${Math.floor(Math.random()*1000000)}`)
  Agent      = MockAgent
  defaultIdentity = new this.Agent({ chain: this })
  constructor () {
    super()
    this.setDirs()
  }

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
}
const BlockInfo    = new WASMFFI.Struct({ height: 'u64', time: 'u64' })
const Coin         = new WASMFFI.Struct({ denom: 'string', amount: 'string' })
const MessageInfo  = new WASMFFI.Struct({ sender: 'string', sent_funds: WASMFFI.rust.vector(Coin) })
const ContractInfo = new WASMFFI.Struct({ address: 'string' })
const Env = new WASMFFI.Struct({
  block:    BlockInfo,
  message:  MessageInfo,
  contract: ContractInfo
})
const InitResponse   = WASMFFI.rust.vector('u8')
const HandleResponse = WASMFFI.rust.vector('u8')
const QueryResponse  = WASMFFI.rust.vector('u8')

export class MockAgent extends Agent {
  static create ()
    { return new MockAgent() }

  address = 'mock'
  chain: Mocknet

  async upload (path: string) {
    const codeId  = ++this.chain.mock.codeId
    const content = this.chain.mock.uploads[codeId] = readFileSync(path)
    return {codeId}
  }

  async instantiate (contract: Contract, msg: any, funds: any[]) {
    const {codeId} = contract
    const content = this.chain.mock.uploads[codeId]
    if (!content) {
      throw new Error(`No code with id ${codeId}`)
    }
    const contractAddress = `mocknet1${Math.floor(Math.random()*1000000)}`
    const strptr = () => 'u32'
    //const instance = this.chain.mock.instances[contractAddress] = new WASMFFI.Wrapper({
    const instance = this.chain.mock.instances[contractAddress] = new WASMFFI.Wrapper({
      init:   [InitResponse,   [Env, strptr()]],
      handle: [HandleResponse, [Env, strptr()]],
      query:  [QueryResponse,  [strptr()]]
    }).use((await WebAssembly.instantiate(content, { env: this.chain.mock.env() })).instance)
    const env_ptr = new WASMFFI.StringPointer('{}')
    instance.utils.allocate(env_ptr)
    const msg_ptr = new WASMFFI.StringPointer('{}')
    instance.utils.allocate(msg_ptr)
    const response =JSON.parse(decode(Uint8Array.from(instance.init(
      env_ptr.ref(),
      msg_ptr.ref()
    ).values)))
    if (response.Err) {
      console.error(colors.red(bold('Contract returned error: '))+JSON.stringify(response.Err))
    } else {
      console.info(JSON.stringify(response))
    }
    throw new Error('TODO')
    return {contractAddress}
  }

  query (contract: Contract, msg: any) {
    const {address} = contract
    if (!this.chain.mock.contracts[address]) {
      throw new Error(`No contract with addr ${address}`)
    }
    const codeId = this.chain.mock.contracts[address]
    const code = this.chain.mock.uploads[codeId]
    console.log(code)
    return Promise.resolve({})
  }

  execute (contract: Contract, msg: any, _3: any, _4?: any, _5?: any) {
    const {address} = contract
    return Promise.resolve({})
  }

  get nextBlock ()
    { return Promise.resolve()  }
  get block ()
    { return Promise.resolve(0) }
  get account ()
    { return Promise.resolve()  }
  get balance ()
    { return Promise.resolve(0) }
  getBalance (_: string)
    { return Promise.resolve(0) }
  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any)
    { return Promise.resolve() }
  sendMany (_1:any, _2:any, _3?:any, _4?:any)
    { return Promise.resolve() }
  getCodeHash (_: any) 
    { return Promise.resolve("SomeCodeHash") }
  getCodeId (_: any) 
    { return Promise.resolve(1) }
  getLabel (_: any) 
    { return Promise.resolve("SomeLabel") }
}
