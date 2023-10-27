/**

  Fadroma Mocknet for Secret Network
  Copyright (C) 2023 Hack.bg

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

**/

import type {
  AgentClass, Uint128, BatchClass, ExecOpts,
  Address, CodeHash, ChainId, CodeId, Message, Label,
  Into
} from '@fadroma/agent'
import {
  bindChainSupport,
  randomBech32, sha256, base16, bech32,
  brailleDump, Error as BaseError, Console as BaseConsole, bold, colors, into,
  Chain, ChainMode, Agent, Batch, assertChain,
  ContractInstance, ContractTemplate
} from '@fadroma/agent'

import * as secp256k1 from '@noble/secp256k1'
import * as ed25519   from '@noble/ed25519'

/** Chain instance containing a local mocknet. */
export class Mocknet extends Chain {
  log = new Console('mocknet')

  /** Agent class. */
  static Agent: AgentClass<MocknetAgent> // populated below

  /** Agent class. */
  Agent: AgentClass<MocknetAgent> = Mocknet.Agent

  /** Current block height. Increments when accessing nextBlock */
  _height = 0

  /** Native token. */
  defaultDenom = 'umock'

  /** Simulation of bank module. */
  balances: Record<Address, Uint128> = {}

  /** Increments when uploading to assign sequential code ids. */
  lastCodeId = 0

  /** Map of code hash to code id. */
  codeIdOfCodeHash: Record<CodeHash, CodeId> = {}

  /** Map of contract address to code id. */
  codeIdOfAddress: Record<Address, CodeId> = {}

  /** Map of contract address to label. */
  labelOfAddress: Record<Address, Label> = {}

  /** Map of code ID to WASM code blobs. */
  uploads: Record<CodeId, {
    codeId: CodeId,
    codeHash: CodeHash,
    wasm: Uint8Array,
    module: WebAssembly.Module,
    cwVersion: CW,
    meta?: any,
  }> = {}

  /** Map of addresses to WASM instances. */
  contracts: Record<Address, MocknetContract<'0.x'|'1.x'>> = {}

  constructor (options: Partial<Mocknet> = {}) {
    super({ id: 'mocknet', ...options, mode: ChainMode.Mocknet })
    this.log.label = this.id
    this.uploads = options.uploads ?? this.uploads
    if (Object.keys(this.uploads).length > 0) {
      this.lastCodeId = Object.keys(this.uploads).map(x=>Number(x)).reduce((x,y)=>Math.max(x,y), 0)
    }
  }

  get isMocknet () {
    return true
  }

  get height () {
    return Promise.resolve(this._height)
  }

  get nextBlock () {
    this._height++
    return Promise.resolve(this._height)
  }

  async query <Q> (
    contract: Address|Partial<ContractInstance>,
    message: Message
  ): Promise<Q> {
    return this.getContract(address).query({ msg })
  }

  async getHash (arg: Address) {
    return this.contracts[arg].codeHash as CodeHash
  }

  async getCodeId (arg: any) {
    const codeId = this.codeIdOfCodeHash[arg] ?? this.codeIdOfAddress[arg]
    if (!codeId) throw new Error(`No code id for hash ${arg}`)
    return Promise.resolve(codeId)
  }

  async getLabel (address: Address) {
    return this.labelOfAddress[address]
  }

  async getBalance (address: Address) {
    return this.balances[address] || '0'
  }

  async upload (wasm: Uint8Array, meta?: any) {
    if (wasm.length < 1) throw new Error('Tried to upload empty binary.')
    const chainId   = this.id
    const codeId    = String(++this.lastCodeId)
    this.log.log('uploading code id', codeId)
    const codeHash  = codeHashForBlob(wasm)
    this.log.log('compiling', wasm.length, 'bytes')
    const module    = await WebAssembly.compile(wasm)
    this.log.log('compiled', wasm.length, 'bytes')
    const exports   = WebAssembly.Module.exports(module)
    const cwVersion = this.checkVersion(exports.map(x=>x.name))
    if (cwVersion === null) throw new Error.NoCWVersion(wasm, module, exports)
    this.codeIdOfCodeHash[codeHash] = String(codeId)
    this.uploads[codeId] = { codeId, codeHash, wasm, meta, module, cwVersion }
    this.log
      .log('code', codeId)
      .log('hash', codeHash)
    return this.uploads[codeId]
  }

  getCode (codeId: CodeId) {
    const code = this.uploads[codeId]
    if (!code) throw new Error(`No code with id ${codeId}`)
    return code
  }

  async instantiate (
    sender: Address,
    instance: Partial<ContractInstance>
  ): Promise<ContractInstance> {
    const { label, initMsg, codeId, codeHash } = instance
    if (!codeId) throw new Error('missing code id')
    // Check code hash
    const { module, cwVersion, codeHash: expectedCodeHash } = this.getCode(codeId)
    if (codeHash !== expectedCodeHash) this.log.warn('Wrong code hash passed with code id', codeId)
    // Resolve lazy init
    const msg = await into(initMsg)
    if (typeof msg === 'undefined') throw new Error.NoInitMsg()
    // Generate address and construct contract
    const address = randomBech32(MOCKNET_ADDRESS_PREFIX).slice(0,20)
    const mocknet = this
    const contract = await new MocknetContract({ mocknet, codeId, codeHash, address, cwVersion })
    // Provide imports and launch contract runtime (wasm instance)
    const {imports, refresh} = contract.makeImports()
    contract.runtime = await WebAssembly.instantiate(module, imports)
    const response = contract.init({ sender, msg })
    const {messages} = parseResult(response, 'instantiate', address)
    this.contracts[address] = contract
    this.codeIdOfAddress[address] = instance.codeId!
    this.labelOfAddress[address] = label!
    await this.passCallbacks(cwVersion, address, messages)
    return { chainId: this.id, address: contract.address, codeId, codeHash, label }
  }

  checkVersion (exports: string[]): CW|null {
    switch (true) {
      case !!(exports.indexOf('instantiate') > -1): return '1.x'
      case !!(exports.indexOf('init')        > -1): return '0.x'
    }
    return null
  }

  getContract (address?: Address) {
    if (!address) throw new Error.NoAddress()
    const instance = this.contracts[address]
    if (!instance) throw new Error.WrongAddress(address)
    return instance
  }

  async execute (
    sender: Address,
    { address, codeHash }: Partial<ContractInstance>,
    msg:   Message,
    funds: unknown,
    memo?: unknown,
    fee?:  unknown
  ) {
    const contract = this.getContract(address)
    const result   = contract.execute({ sender, msg })
    const response = parseResult(result, 'execute', address)
    if (response.data !== null) response.data = b64toUtf8(response.data)
    await this.passCallbacks(contract.cwVersion!, address!, response.messages)
    return response
  }

  async passCallbacks (
    cwVersion: CW,
    sender:    Address,
    messages:  Array<any>
  ) {
    if (!sender) throw new Error("mocknet.passCallbacks: can't pass callbacks without sender")
    switch (cwVersion) {
      case '0.x': for (const message of messages) {
        const { wasm } = message || {}
        if (!wasm) { this.log.warnNonWasm(message); continue }
        const { instantiate, execute } = wasm
        if (instantiate) {
          const { code_id: codeId, callback_code_hash: codeHash, label, msg, send } = instantiate
          const instance = await this.instantiate(sender, new ContractInstance({
            codeHash, codeId, label, initMsg: JSON.parse(b64toUtf8(msg)),
          }))
          this.log.initCallback(sender, label, codeId, codeHash, instance.address!)
        } else if (execute) {
          const { contract_addr, callback_code_hash, msg, send } = execute
          const response = await this.execute(
            sender,
            { address: contract_addr, codeHash: callback_code_hash },
            JSON.parse(b64toUtf8(msg)),
            send
          )
          this.log.execCallback(sender, contract_addr, callback_code_hash)
        } else {
          this.log.warnNonInitExec(message)
        }
      }; break
      case '1.x': for (const message of messages) {
        const { msg: { wasm = {} } = {} } = message||{}
        if (!wasm) { this.log.warnNonWasm(message); continue }
        const { instantiate, execute } = wasm
        if (instantiate) {
          const { code_id: codeId, code_hash: codeHash, label, msg, send } = instantiate
          const instance = await this.instantiate(sender, new ContractInstance({
            codeHash, codeId, label, initMsg: JSON.parse(b64toUtf8(msg)),
          }))
          this.log.initCallback(sender, label, codeId, codeHash, instance.address!)
        } else if (execute) {
          const { contract_addr, callback_code_hash, msg, send } = execute
          const response = await this.execute(
            sender,
            { address: contract_addr, codeHash: callback_code_hash },
            JSON.parse(b64toUtf8(msg)),
            send
          )
          this.log.execCallback(sender, contract_addr, callback_code_hash)
        } else {
          this.log.warnNonInitExec(message)
        }
      }; break
      default: throw Object.assign(
        new Error('passCallback: unknown CW version'), { sender, messages }
      )
    }
  }

  getApi () {
    return Promise.resolve({})
  }
}

class MocknetAgent extends Agent {
  declare chain: Mocknet

  /** The address of this agent. */
  address: Address = randomBech32(MOCKNET_ADDRESS_PREFIX).slice(0,20)

  constructor (options: Partial<Agent> & { chain: Mocknet }) {
    super({ name: 'MocknetAgent', ...options||{}})
    this.chain = options.chain
    this.log.label = `${this.address} @ ${this.chain.id}`
  }

  get defaultDenom (): string {
    return assertChain(this).defaultDenom
  }

  get account () {
    this.log.warn('account: stub')
    return Promise.resolve({})
  }

  /** Upload a binary to the mocknet. */
  protected async doUpload (wasm: Uint8Array): Promise<ContractTemplate> {
    return new ContractTemplate(await this.chain.upload(wasm))
  }

  /** Instantiate a contract on the mocknet. */
  protected async doInstantiate (
    codeId: CodeId|Partial<ContractTemplate>,
    options: {
      initMsg: Into<Message>
    }
  ): Promise<Partial<ContractInstance>> {
    options = { ...options }
    options.initMsg = await into(options.initMsg)
    const { address, codeHash, label } = await this.chain.instantiate(this.address, options)
    return {
      chainId:  this.chain.id,
      address:  address!,
      codeHash: codeHash!,
      label:    label!,
      initBy:   this.address,
      initTx:   ''
    }
  }

  protected async doExecute (
    contract: { address: Address },
    message:  Message,
    options:  ExecOpts = {}
  ): Promise<unknown> {
    return await this.chain.execute(
      this.address,
      contract,
      message,
      options.send,
      options.memo,
      options.fee
    )
  }

  protected async doQuery <Q> (
    contract: Address|Partial<ContractInstance>,
    message:  Message
  ): Promise<Q> {
    return await assertChain(this).query(contract, message)
  }

  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any) {
    this.log.warn('send: stub')
    return Promise.resolve()
  }

  sendMany (_1:any, _2:any, _3?:any, _4?:any) {
    this.log.warn('sendMany: stub')
    return Promise.resolve()
  }

  /** Message batch that warns about unsupported messages. */
  static Batch: BatchClass<MocknetBatch>
}

class MocknetBatch extends Batch {

  declare agent: MocknetAgent

  get log () {
    return this.agent.log.sub('(batch)')
  }

  async submit (memo = "") {
    this.log.info('Submitting mocknet batch...')
    const results = []
    for (const { init, instantiate = init, exec, execute = exec } of this.msgs) {
      if (!!init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        results.push(await this.agent.instantiate(new ContractInstance({
          codeId: String(codeId), initMsg: msg, codeHash, label,
        })))
      } else if (!!exec) {
        const { sender, contract: address, codeHash, msg, funds: send } = exec
        results.push(await this.agent.execute({ address, codeHash }, msg, { send }))
      } else {
        this.log.warn('MocknetBatch#submit: found unknown message in batch, ignoring')
        results.push(null)
      }
    }
    return results
  }

  save (name: string): Promise<unknown> {
    throw new Error('MocknetBatch#save: not implemented')
  }

}

bindChainSupport(Mocknet, MocknetAgent, MocknetBatch)

export {
  Mocknet      as Chain,
  MocknetAgent as Agent,
  MocknetBatch as Batch
}

export type CW = '0.x' | '1.x'

export type CWAPI<V extends CW> = {
  imports: {
    memory: WebAssembly.Memory
    env: {
      debug (msg: Pointer): Pointer

      db_read   (key: Pointer): Pointer
      db_write  (key: Pointer, val: Pointer): void
      db_remove (key: Pointer): void

      query_chain (req: Pointer): Pointer
    }
  },
  exports: Allocator & {
    query (msg: Pointer): Pointer
  }
} & ({
  /** CosmWasm v0 API */
  '0.x': {
    imports: {
      env: {
        canonicalize_address (src: Pointer, dst: Pointer): ErrCode
        humanize_address (src: Pointer, dst: Pointer): ErrCode
      }
    },
    exports: {
      init (env: Pointer, msg: Pointer): Pointer
      handle (env: Pointer, msg: Pointer): Pointer
    },
  },
  /** CosmWasm v0 API */
  '1.x': {
    imports: {
      memory: WebAssembly.Memory
      env: {
        addr_canonicalize (src: Pointer, dst: Pointer): ErrCode
        addr_humanize (src: Pointer, dst: Pointer): ErrCode
        addr_validate (addr: Pointer): ErrCode

        ed25519_sign (msg: Pointer, priv: Pointer): Pointer
        ed25519_verify (msg: Pointer, sig: Pointer, pub: Pointer): Pointer
        ed25519_batch_verify (msgs: Pointer, sigs: Pointer, pubs: Pointer): Pointer

        secp256k1_sign (msg: Pointer, priv: Pointer): Pointer
        secp256k1_verify (hash: Pointer, sig: Pointer, pub: Pointer): Pointer
        secp256k1_recover_pubkey (hash: Pointer, sig: Pointer, param: Pointer): Pointer

        gas_evaporate (...args: any): any
      }
    },
    exports: {
      requires_staking (): Pointer
      instantiate (env: Pointer, info: Pointer, msg: Pointer): Pointer
      execute (env: Pointer, info: Pointer, msg: Pointer): Pointer
    }
  }
}[V])


export class MocknetContract<V extends CW> {
  log = new Console('mocknet')
  mocknet?:   Mocknet
  address?:   Address
  codeHash?:  CodeHash
  codeId?:    CodeId
  cwVersion?: V
  runtime?:   WebAssembly.Instance<CWAPI<V>['exports']>
  storage = new Map<string, Buffer>()

  constructor (options: Partial<MocknetContract<V>> = {}) {
    Object.assign(this, options)
  }

  get initMethod (): Function {
    switch (this.cwVersion) {
      case '0.x': return (this.runtime!.exports as CWAPI<'0.x'>['exports']).init
      case '1.x': return (this.runtime!.exports as CWAPI<'1.x'>['exports']).instantiate
      default: throw new Error('Could not find init/instantiate entrypoint')
    }
  }

  get execMethod (): Function {
    switch (this.cwVersion) {
      case '0.x': return (this.runtime!.exports as CWAPI<'0.x'>['exports']).handle
      case '1.x': return (this.runtime!.exports as CWAPI<'1.x'>['exports']).execute
      default: throw new Error('Could not find handle/execute entrypoint')
    }
  }

  get queryMethod (): Function {
    return this.runtime!.exports.query
  }

  pass = (data: any): Pointer => passJson(this.runtime!.exports, data)

  readUtf8 = (ptr: Pointer) => JSON.parse(readUtf8(this.runtime!.exports, ptr))

  initPointers = ({ env, info, msg }: any = {}): Pointer[] => {
    if (typeof msg === 'undefined') throw new Error("Can't init contract with undefined init msg")
    switch (this.cwVersion) {
      case '0.x': return [this.pass(env), this.pass(msg)]
      case '1.x': return [this.pass(env), this.pass(info), this.pass(msg)]
      default: throw new Error('Could not find init/instantiate entrypoint parameters')
    }
  }

  execPointers = ({ env, info, msg }: any = {}): Pointer[] => {
    if (typeof msg === 'undefined') throw new Error("Can't execute empty transaction")
    switch (this.cwVersion) {
      case '0.x': return [this.pass(env), this.pass(msg)]
      case '1.x': return [this.pass(env), this.pass(info), this.pass(msg)]
      default: throw new Error('Could not find handle/execute entrypoint parameters')
    }
  }

  queryPointers = ({ env, msg }: any = {}): Pointer[] => {
    if (typeof msg === 'undefined') throw new Error("Can't perform empty query")
    switch (this.cwVersion) {
      case '0.x': return [this.pass(msg)]
      case '1.x': return [this.pass(env), this.pass(msg)]
      default: throw new Error('Could not find query entrypoint parameters')
    }
  }

  init = ({ sender, env, info, msg }: Partial<{
    sender: Address, env: object, info: object, msg: Message
  }> = {}) => {
    if (!sender) throw new Error('no sender')
    const context = this.makeContext(sender)
    env ??= context.env
    info ??= context.info
    try {
      const init = this.initMethod
      if (!init) {
        this.log.error('WASM exports of contract:', ...Object.keys(this.runtime?.exports??{}))
        throw new Error('Missing init entrypoint in contract.')
      }
      return this.readUtf8(this.initMethod(...this.initPointers({ env, info, msg })))
    } catch (e: any) {
      this.log
        .error(bold(this.address), `crashed on init:`, e.message)
        .error(bold('Args:'), { env, info, msg })
      throw e
    }
  }

  execute = ({ sender, env, info, msg }: {
    sender: Address, env?: object, info?: object, msg: Message
  }) => {
    const context = this.makeContext(sender)
    env ??= context.env
    info ??= context.info
    this.log.log(bold(this.address), `handle: ${JSON.stringify(msg)}`)
    try {
      return this.readUtf8(this.execMethod(...this.execPointers({ env, info, msg })))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on handle:`, e.message)
      this.log.error(bold('Args:'), { env, info, msg })
      throw e
    }
  }

  query = ({ env, msg }: {
    msg: Message, env?: object
  }) => {
    const context = this.makeContext('query')
    env ??= context.env
    this.log.log(bold(this.address), `query: ${JSON.stringify(msg)}`)
    try {
      const result = this.readUtf8(this.queryMethod(...this.queryPointers({ env, msg })))
      const parsed = JSON.parse(b64toUtf8(parseResult(result, 'query', this.address)))
      return parsed
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on query:`, e.message)
      throw e
    }
  }

  makeContext = (sender: Address, now: number = + new Date()) => {
    if (!this.mocknet) throw new Error.NoChain()
    const chain_id = this.mocknet.id
    const height = Math.floor(now/5000)
    const time = Math.floor(now/1000)
    const sent_funds: any[] = []
    if (!this.address) throw new Error.Missing.Address()
    if (!this.codeHash) throw new Error.Missing.CodeHash()
    const { address, codeHash } = this
    if (this.cwVersion === '0.x') {
      const block = { height, time, chain_id }
      const message = { sender, sent_funds }
      const contract = { address }
      const contract_key = ""
      const contract_code_hash = codeHash
      return { env: { block, message, contract, contract_key, contract_code_hash } }
    } else if (this.cwVersion === '1.x') {
      const block = { height, time: String(time), chain_id }
      const transaction = { index: 0 }
      const contract = { address }
      return { env: { block, transaction, contract }, info: { sender, funds: [] } }
    } else {
      throw new Error('Failed to detect CW API version for this contract')
    }
  }

  makeImports = (): { imports: CWAPI<V>['imports'], refresh: Function } => {
    const {log, runtime, storage, address, mocknet} = this
    // initial memory
    const wasmMemory = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    // when reentering, get the latest memory
    // See: https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324
    const refresh = () => {
      if (!this.runtime) throw new Error('WASM instance missing')
      const {memory, allocate} = this.runtime.exports
      return {memory, allocate}
    }

    let imports = {
      memory: wasmMemory,
      env: {
        db_read (keyPointer: Pointer) {
          const memory = refresh()
          const key = readUtf8(memory, keyPointer)
          const val = storage.get(key)
          log.debug(bold(address), `db_read: ${bold(key)}`, val ? brailleDump(val) : null)
          if (storage.has(key)) {
            return passBuffer(memory, val!)
          } else {
            return 0
          }
        },
        db_write (keyPointer: Pointer, valPointer: Pointer) {
          const memory = refresh()
          const key = readUtf8(memory, keyPointer)
          const val = readBuffer(memory, valPointer)
          storage.set(key, val)
          log.debug(bold(address), `db_write: ${bold(key)}`, brailleDump(val))
        },
        db_remove (keyPointer: Pointer) {
          const memory = refresh()
          const key = readUtf8(memory, keyPointer)
          log.debug(bold(address), `db_remove:`, bold(key))
          storage.delete(key)
        },
        query_chain (reqPointer: Pointer) {
          const memory = refresh()
          const req = readUtf8(memory, reqPointer)
          log.debug(bold(address), 'query_chain:', req)
          const { wasm } = JSON.parse(req)
          if (!wasm) throw new Error.Query.NonWasm(address, req)
          const { smart } = wasm
          if (!wasm) throw new Error.Query.NonSmart(address, req)
          if (!mocknet) throw new Error.Query.NoMocknet(address, req)
          const { contract_addr, callback_code_hash, msg } = smart
          const queried = mocknet.getContract(contract_addr)
          if (!queried) throw new Error(
            `MocknetContract ${address} made a query to contract ${contract_addr}` +
            ` which was not found in the Mocknet: ${JSON.stringify(req)}`
          )
          const decoded = JSON.parse(b64toUtf8(msg))
          log.debug(`${bold(address)} queries ${contract_addr}:`, decoded)
          const result = parseResult(queried.query({ msg: decoded }), 'query_chain', contract_addr)
          log.debug(`${bold(contract_addr)} responds to ${address}:`, b64toUtf8(result))
          return passJson(memory, { Ok: { Ok: result } })
          // https://docs.rs/secret-cosmwasm-std/latest/secret_cosmwasm_std/type.QuerierResult.html
        }
      }
    }

    if (this.cwVersion === '0.x') {

      imports = { ...imports, env: { ...imports.env,
        canonicalize_address (srcPointer: Pointer, dstPointer: Pointer) {
          const memory = refresh()
          const human  = readUtf8(memory, srcPointer)
          const canon  = bech32.fromWords(bech32.decode(human).words)
          const dst    = region(memory.memory.buffer, dstPointer)
          log.debug(bold(address), `canonize:`, human, '->', `${canon}`)
          writeToRegion(memory, dstPointer, canon)
          return 0
        },
        humanize_address (srcPointer: Pointer, dstPointer: Pointer) {
          const memory = refresh()
          const canon  = readBuffer(memory, srcPointer)
          const human  = bech32.encode(MOCKNET_ADDRESS_PREFIX, bech32.toWords(canon))
          const dst    = region(memory.memory.buffer, dstPointer)
          log.debug(bold(address), `humanize:`, canon, '->', human)
          writeToRegionUtf8(memory, dstPointer, human)
          return 0
        },
      } } as CWAPI<'0.x'>['imports']

    } else if (this.cwVersion === '1.x') {

      imports = { ...imports, env: { ...imports.env,

        addr_canonicalize (srcPointer: Pointer, dstPointer: Pointer) {
          const memory = refresh()
          const human  = readUtf8(memory, srcPointer)
          const canon  = bech32.fromWords(bech32.decode(human).words)
          const dst    = region(memory.memory.buffer, dstPointer)
          log.debug(bold(address), `canonize:`, human, '->', `${canon}`)
          writeToRegion(memory, dstPointer, canon)
          return 0
        },
        addr_humanize (srcPointer: Pointer, dstPointer: Pointer) {
          const memory = refresh()
          const canon  = readBuffer(memory, srcPointer)
          const human  = bech32.encode(MOCKNET_ADDRESS_PREFIX, bech32.toWords(canon))
          const dst    = region(memory.memory.buffer, dstPointer)
          log.debug(bold(address), `humanize:`, canon, '->', human)
          writeToRegionUtf8(memory, dstPointer, human)
          return 0
        },
        addr_validate (srcPointer: Pointer) {
          log.warnStub('addr_validate')
          return 0
        },

        secp256k1_sign (msg: Pointer, priv: Pointer) {
          const memory     = refresh()
          const message    = readBuffer(memory, msg)
          const privateKey = readBuffer(memory, priv)
          const signature  = secp256k1.sign(message, privateKey)
          return passBuffer(memory, signature.toCompactRawBytes())
        },
        secp256k1_verify (hashPointer: Pointer, sig: Pointer, pub: Pointer) {
          const memory    = refresh()
          const hash      = readBuffer(memory, hashPointer)
          const signature = readBuffer(memory, sig)
          const publicKey = readBuffer(memory, pub)
          const valid     = secp256k1.verify(signature, hash, publicKey)
          return valid ? 1 : 0
        },
        secp256k1_recover_pubkey (hashPointer: Pointer, sig: Pointer, param: Pointer) {
          const memory        = refresh()
          const hash          = readBuffer(memory, hashPointer)
          const signature     = secp256k1.Signature.fromCompact(readBuffer(memory, sig))
          const recoveryParam = readBuffer(memory, param)
          const recovered     = signature.recoverPublicKey(hash)
          log.warn('sec256k1_recover_pubkey: not implemented')
          return 0
        },

        ed25519_sign (msg: Pointer, priv: Pointer) {
          const memory    = refresh()
          const message   = readBuffer(memory, msg)
          const privKey   = readBuffer(memory, priv)
          const signature = ed25519.sign(message, privKey)
          return passBuffer(memory, signature)
          log.warnStub('ed25519_sign')
          return 0
        },
        ed25519_verify (msg: Pointer, sig: Pointer, pub: Pointer) {
          const memory    = refresh()
          const message   = readBuffer(memory, msg)
          const signature = readBuffer(memory, sig)
          const pubKey    = readBuffer(memory, pub)
          const valid     = ed25519.verify(signature, message, pubKey)
          return valid ? 1 : 0
        },
        ed25519_batch_verify (msgs: Pointer, sigs: Pointer, pubs: Pointer) {
          // ??? how to read &[&[u8]] ???
          const memory     = refresh()
          const messages   = readBuffer(memory, msgs)
          const signatures = readBuffer(memory, sigs)
          const publicKeys = readBuffer(memory, pubs)
          log.warnStub('ed25519_batch_verify')
          return 0
        },

        debug (ptr: Pointer) {
          const memory = refresh()
          log.debug(bold(address), `debug:`, readUtf8(memory, ptr))
          return 0
        },

        check_gas (): Pointer {
          log.debug('check_gas: not implemented')
          return 0
        },
        gas_evaporate (): Pointer {
          log.debug('gas_evaporate: not implemented')
          return 0
        }

      } } as CWAPI<'1.x'>['imports']

    } else {
      throw new Error('Failed to detect CW API version for this contract')
    }
    return {
      imports: imports as CWAPI<V>['imports'],
      refresh
    }
  }

}

declare namespace WebAssembly {
  class Module {
    static exports (module: Module): { name: string, kind: string }[]
  }
  function compile (code: unknown):
    Promise<Module>
  class Instance<T> {
    exports: T
  }
  function instantiate <V extends CW> (code: unknown, world: unknown):
    Promise<Instance<CWAPI<V>['exports']>>
  class Memory {
    constructor (options: { initial: number, maximum: number })
    buffer: any
  }
}

/** Error code returned by contract. */
type ErrCode = number
/** Address in WASM VM memory. */
type Pointer     = number
/** Number of bytes. */
type Size    = number
/** Memory region as allocated by CosmWasm */
type Region = [Pointer, Size, Size, Uint32Array?]
/** Heap with allocator for talking to WASM-land */
interface Allocator {
  memory: WebAssembly.Memory
  allocate    (len: Size): Pointer
  deallocate? (ptr: Pointer): void
}

export const MOCKNET_ADDRESS_PREFIX = 'mocked'

export const codeHashForBlob = (blob: Uint8Array) => base16.encode(sha256(blob))

const decoder = new TextDecoder()
declare class TextDecoder { decode (data: any): string }

const encoder = new TextEncoder()
declare class TextEncoder { encode (data: string): any }

/** Convert a Result<T, E> returned from Rust side to Ok or throw */
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
export const region = (buffer: any, ptr: Pointer): Region => {
  const u32a = new Uint32Array(buffer)
  const addr = u32a[ptr/4+0] // Region.offset
  const size = u32a[ptr/4+1] // Region.capacity
  const used = u32a[ptr/4+2] // Region.length
  return [addr, size, used, u32a]
}
/** Read contents of region referenced by region pointer into a string. */
export const readUtf8 = ({ memory: { buffer }, deallocate }: Allocator, ptr: Pointer): string => {
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const view = new DataView(buffer, addr, used)
  const data = decoder.decode(view)
  drop({ deallocate }, ptr)
  return data
}
/** Read contents of region referenced by region pointer into a string. */
export const readBuffer = ({ memory: { buffer } }: Allocator, ptr: Pointer): Buffer => {
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const output = Buffer.alloc(size)
  for (let i = addr; i < addr + size; i++) {
    output[i - addr] = u8a[i]
  }
  return output
}
/** Serialize a datum into a JSON string and pass it into the contract. */
export const passJson = <T> (memory: Allocator, data: T): Pointer => {
  if (typeof data === 'undefined') throw new Error('Tried to pass undefined value into contract')
  return passBuffer(memory, utf8toBuffer(JSON.stringify(data)))
}
/** Allocate region, write data to it, and return the pointer.
  * See: https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324 */
export const passBuffer = ({ memory, allocate }: Allocator, data: ArrayLike<number>): Pointer => {
  const ptr = allocate(data.length)
  const { buffer } = memory // must be after allocation - see [1]
  const [ addr, _, __, u32a ] = region(buffer, ptr)
  u32a![ptr/4+2] = u32a![ptr/4+1] // set length to capacity
  write(buffer, addr, data)
  return ptr
}
/** Write UTF8-encoded data to address of region referenced by pointer. */
export const writeToRegionUtf8 = (memory: Allocator, ptr: Pointer, data: string): void =>
  writeToRegion(memory, ptr, encoder.encode(data))
/** Write data to address of region referenced by pointer. */
export const writeToRegion = (
  { memory: { buffer } }: Allocator, ptr: Pointer, data: ArrayLike<number>
): void => {
  const [addr, size, _, u32a] = region(buffer, ptr)
  if (data.length > size) { // if data length > Region.capacity
    throw new Error(`Mocknet: tried to write ${data.length} bytes to region of ${size} bytes`)
  }
  const usedPointer = ptr/4+2
  u32a![usedPointer] = data.length // set Region.length
  write(buffer, addr, data)
}
/** Write data to memory address. */
export const write = (buffer: ArrayLike<number>, addr: number, data: ArrayLike<number>): void =>
  new Uint8Array(buffer).set(data, addr)
/** Write UTF8-encoded data to memory address. */
export const writeUtf8 = (buffer: ArrayLike<number>, addr: number, data: string): void =>
  new Uint8Array(buffer).set(encoder.encode(data), addr)
/** Deallocate memory. Fails silently if no deallocate callback is exposed by the blob. */
export const drop = ({ deallocate }: { deallocate: Allocator['deallocate'] }, ptr: Pointer): void =>
  deallocate && deallocate(ptr)
/** Convert base64 string to utf8 string */
export const b64toUtf8 = (str: string) => Buffer.from(str, 'base64').toString('utf8')
/** Convert utf8 string to base64 string */
export const utf8toB64 = (str: string) => Buffer.from(str, 'utf8').toString('base64')
/** Convert utf8 string to buffer. */
export const utf8toBuffer = (str: string) => Buffer.from(str, 'utf8')
/** Convert buffer to utf8 string. */
export const bufferToUtf8 = (buf: Buffer) => buf.toString('utf8')

export const Console = (()=>{
  return class MocknetConsole extends BaseConsole {
    constructor (label = 'mocknet') { super(label) }
    warnStub = (name: string) => this.warn(`mocknet: ${name}: stub`)
    showDebug = true
    initCallback = (
      sender: Address, label: Label, codeId: CodeId, codeHash: CodeHash, instance: Address
    ) => this.debug(
      `callback from ${bold(sender)}: instantiated contract`, bold(label),
      'from code id', bold(codeId), 'with hash', bold(codeHash),
      'at address', bold(instance)
    )
    execCallback = (
      sender: Address, contract: Address, codeHash: CodeHash
    ) => this.debug(
      `Callback from ${bold(sender)}: executed transaction`,
      'on contract', bold(contract), 'with hash', bold(codeHash),
    )
    warnNonWasm = (message: unknown) => this.warn(
      'mocknet.execute: transaction returned non-wasm message, ignoring:',
      message
    )
    warnNonInitExec = (message: unknown) => this.warn(
      'mocknet.execute: transaction returned wasm message that was not '+
      '"instantiate" or "execute", ignoring:',
      message
    )
  }
})()

export const Error = (()=>{
  class MocknetError extends BaseError {
    static NoAddress = this.define('NoAddress', () =>
      `Mocknet: can't get instance without address`)
    static WrongAddress = this.define('WrongAddress', (address: string) =>
      `Mocknet: no contract at ${address}`)
    static NoChain = this.define('NoChain', () =>
      `MocknetAgent: chain not set`)
    static NoBackend = this.define('NoBackend', () =>
      `Mocknet: backend not set`)
    static NoInitMsg = this.define('NoInitMsg', () =>
      'Mocknet: tried to instantiate with undefined initMsg')
    static NoCWVersion = this.define('NoCWVersion',
      (_, __, ___) => 'Mocknet: failed to detect CosmWasm API version from module',
      (err, wasmCode, wasmModule, wasmExports) => Object.assign(err, {
        wasmCode, wasmModule, wasmExports
      }))
    static Query: typeof MocknetError_Query
  }
  class MocknetError_Query extends MocknetError {
    static NonWasm = this.define('NonWasm', (address, req) =>
      `Mocknet: contract ${address} made a non-wasm query: ${JSON.stringify(req)}`,
      (err, req) => Object.assign(err, { req }))
    static NonSmart = this.define('NonSmart', (address, req) =>
      `Mocknet: contract ${address} made a non-smart wasm query: ${JSON.stringify(req)}`,
      (err, req) => Object.assign(err, { req }))
    static NoMocknet = this.define('NoMocknet', (address, req) =>
      `Mocknet: contract ${address} made a query while isolated: ${JSON.stringify(req)}`,
      (err, req) => Object.assign(err, { req }))
  }
  return Object.assign(MocknetError, { Query: MocknetError_Query })
})() //MocknetError
