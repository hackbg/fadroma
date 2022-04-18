import { readFileSync, decode, Console, bold, colors, } from '@hackbg/toolbox'
import { Chain, Agent, Artifact, Template, Instance } from '@fadroma/ops'
import { URL } from 'url'
import WASMFFI from 'wasm-ffi'

const { Wrapper, Struct, StringPointer, types } = WASMFFI
const console = Console('@fadroma/mocknet')

/*
const instance = this.chain.mock.instances[address] = new Wrapper({
  init:   [InitResponse,   [Env, strptr()]],
  handle: [HandleResponse, [Env, strptr()]],
  query:  [QueryResponse,  [strptr()]]
}).use((await WebAssembly.instantiate(content, { env: this.chain.mock.env() })).instance)
 */

const tStrPtr = { ...types.string, type: types.string }

const decoder = new TextDecoder()
const encoder = new TextEncoder()

export class Contract {
  static async load (code) {
    const { instance } = await WebAssembly.instantiate(code)
    return new this({}, instance)
  }
  wrapper = new Wrapper({
    init:   ['uint32', ['uint32', 'uint32']],
    handle: ['uint32', ['uint32', 'uint32']],
    query:  ['uint32', ['uint32']],
  })
  constructor (
    public readonly world,
    public readonly instance
  ) {
    this.wrapper.use(instance)
  }
  init (env, msg) {
    return this.read(this.wrapper.init(this.pass(env), this.pass(msg)))
  }
  handle (env, msg) {
    return this.read(this.wrapper.handle(this.pass(env), this.pass(msg)))
  }
  query (env, msg) {
    return this.read(this.wrapper.query(this.pass(env)))
  }
  private pass (data) {
    const dataStr = JSON.stringify(data)
    const dataBuf = this.wrapper.utils.encodeString(dataStr)
    const dataLen = dataBuf.byteLength
    const dataPtr = this.wrapper.__allocate(dataBuf.byteLength+1000)
    return dataPtr
  }
  private read (ptr) {
    const retVal = this.wrapper.utils.readPointer(ptr, tStrPtr).view
    const retStr = decoder.decode(retVal).replace(/\0$/, '')
    const retObj = JSON.parse(retStr)
    return retObj
  }
}

export class Contract2 {
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
    this.drop(envBuf)
    this.drop(msgBuf)
    return retData
  }
  handle (env, msg) {
    const envBuf = this.pass(env)
    const msgBuf = this.pass(msg)
    const retBuf = this.read(this.instance.exports.handle(envBuf, msgBuf))
    this.drop(envBuf)
    this.drop(msgBuf)
    return retBuf
  }
  query (env, msg) {
    const msgBuf = this.pass(msg)
    const retBuf = this.read(this.instance.exports.query(msgBuf))
    this.drop(msgBuf)
    return retBuf
  }
  /** [1] https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324 */
  private pass (data) {
    const dataString = JSON.stringify(data) + '\0'
    const dataBufPtr = this.instance.exports.allocate(dataString.length)
    const { buffer } = this.instance.exports.memory // must be after allocation - see [1]
    const dataOffset = new Uint32Array(buffer)[dataBufPtr/4]
    const dataBinStr = encoder.encode(dataString)
    new Uint8Array(buffer).set(dataBinStr, dataOffset)
    return dataBufPtr
  }
  private read (ptr) {
    const { buffer } = this.instance.exports.memory
    const ptrOffset  = new Uint32Array(buffer)[ptr/4]
    const uint8Array = new Uint8Array(buffer)
    let end = ptrOffset // loop for null byte
    while (uint8Array[end]) ++end
    const retView = new DataView(buffer, ptrOffset, end - ptrOffset)
    const retData = decoder.decode(retView)
    const retObj  = JSON.parse(retData)
    this.drop(ptr)
    return retObj
  }
  private drop (ptr) {
    // TODO!
    // this.instance.exports.deallocate(ptr)
  }
}

export const Region = new Struct({
  offset:   'uint32',
  capacity: 'uint32',
  length:   'uint32'
})

export function pass (wrap, data: any = "") {
  //const dataStr = JSON.stringify(data)
  const dataStr = "                  {}                      \0"
  const dataBuf = wrap.utils.encodeString(dataStr)
  const dataLen = dataBuf.byteLength
  const dataPtr = wrap.__allocate(dataBuf.byteLength+1000)
  //const dataReg = new Region({ offset: dataPtr, capacity: dataLen, length: dataLen })
  //const dataRegPtr = wrap.utils.writeStruct(dataReg, Region)
  return dataPtr
}

export async function runInit (world, code, env, msg) {
  const wrap = new Wrapper({ init: ['uint32', ['string', 'string']] })
  const inst = await WebAssembly.instantiate(code)
  const used = wrap.use(inst.instance)
  const retPtr = used.init(pass(wrap, env), pass(wrap, msg))
  const retVal = decoder.decode(wrap.utils.readPointer(retPtr, tStrPtr).view).replace('\0', '')
  return JSON.parse(retVal)
}

export async function runHandle (world, code, env, msg) {
  const wrap = new Wrapper({ handle: ['uint32', ['uint32', 'uint32']] })
  const inst = await WebAssembly.instantiate(code)
  const used = wrap.use(inst.instance)
  const retPtr = used.handle(pass(wrap, env), pass(wrap, msg))
  const retVal = decoder.decode(wrap.utils.readPointer(retPtr, tStrPtr).view).replace('\0', '')
  return JSON.parse(retVal)
}

export async function runQuery (world, code, env, msg) {
  const wrap = new Wrapper({ query: ['uint32', ['uint32']] })
  const inst = await WebAssembly.instantiate(code)
  const used = wrap.use(inst.instance)
  const retPtr = used.query(pass(wrap, msg))
  const retVal = decoder.decode(wrap.utils.readPointer(retPtr, tStrPtr).view).replace('\0', '')
  return JSON.parse(retVal)
}

export class MockAgent extends Agent {

  static create (chain: Mocknet) { return new MockAgent(chain, 'MockAgent') }

  constructor (readonly chain: Mocknet, readonly name: string = 'mock') {
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
    const { mock } = this.chain

    if (!code) {
      throw new Error(`No code with id ${codeId}`)
    }
    const address = `mocknet1${Math.floor(Math.random()*1000000)}`
    mock.instances[address] = {}
    const response = await runInit({}, code, {}, msg)
    if (response.Err) {
      console.error(colors.red(bold('Contract returned error: '))+JSON.stringify(response.Err))
    } else {
      console.info(JSON.stringify(response))
    }
    throw 'TODO'
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
