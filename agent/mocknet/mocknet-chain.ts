import {
  Chain, ChainMode, Agent, Bundle, Contract, assertChain, into
} from '../agent'
import type {
  AgentClass, CodeHash, Uint128, CodeId, Label,
  Address, AgentOpts, AnyContract, BundleClass, Client, ExecOpts, Message, Uploaded,
} from '../agent'

import { Error, Console, bold } from './mocknet-base'
import {
  MOCKNET_ADDRESS_PREFIX, codeHashForBlob,
  parseResult, MocknetContract, b64toUtf8
} from './mocknet-impl'

import { randomBech32 } from '@hackbg/4mat'

/** Chain instance containing a local mocknet. */
export class Mocknet extends Chain {
  /** Agent class. */
  static Agent: AgentClass<MocknetAgent> // populated below
  /** Agent class. */
  Agent: AgentClass<MocknetAgent> = Mocknet.Agent
  /** Block height. */
  _height = 0
  /** Native token. */
  defaultDenom = 'umock'
  /** Simulation of bank module. */
  balances: Record<Address, Uint128> = {}

  nextCodeId = 0

  codeIdOfCodeHash: Record<CodeHash, CodeId> = {}

  codeIdOfAddress: Record<Address, CodeId> = {}

  labelOfAddress: Record<Address, Label> = {}

  /** Map of code ID to WASM code blobs. */
  uploads: Record<CodeId, unknown> = {}
  /** Map of addresses to WASM instances. */
  contracts: Record<Address, MocknetContract<'0.x'|'1.x'>> = {}

  constructor (options: Partial<Mocknet> = {}) {
    super({ id: 'mocknet', ...options, mode: ChainMode.Mocknet })
    this.log.label = 'Mocknet'
    this.uploads = options.uploads ?? this.uploads
    if (Object.keys(this.uploads).length > 0) {
      this.nextCodeId = Object.keys(this.uploads).map(x=>Number(x)).reduce((x,y)=>Math.max(x,y), 0)
      this.nextCodeId += 1
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

  async query <T, U> ({ address, codeHash }: Partial<Client>, msg: Message): Promise<U> {
    return this.getInstance(address).query({ msg })
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

  upload (blob: Uint8Array) {
    const chainId  = this.chain.id
    const codeId   = String(++this.chain.nextCodeId)
    const content  = this.chain.uploads[codeId] = blob
    const codeHash = codeHashForBlob(blob)
    this.chain.codeIdOfCodeHash[codeHash] = String(codeId)
    return { codeId, codeHash }
  }
  getCode (codeId: CodeId) {
    const code = this.chain.uploads[codeId]
    if (!code) throw new Error(`No code with id ${codeId}`)
    return code
  }
  async instantiate (sender: Address, instance: AnyContract): Promise<Partial<AnyContract>> {
    const label = instance.label
    const msg = await into(instance.initMsg)
    if (typeof msg === 'undefined') throw new Error('Tried to instantiate a contract with undefined initMsg')
    const address = randomBech32(MOCKNET_ADDRESS_PREFIX)
    const contract = await new MocknetContract({
      mocknet:   this,
      cwVersion: '1.x',
      codeId:    instance.codeId,
      codeHash:  instance.codeHash,
      address
    })
    await contract.load(this.getCode(instance.codeId!))
    const response = contract.init({ sender, msg })
    const {messages} = parseResult(response, 'instantiate', address)
    this.contracts[address] = contract
    this.codeIdOfAddress[address] = instance.codeId!
    this.labelOfAddress[address] = label!
    await this.passCallbacks(address, messages)
    return {
      address:  contract.address,
      chainId:  this.id,
      codeId:   instance.codeId,
      codeHash: instance.codeHash,
      label
    }
  }
  getInstance (address?: Address) {
    if (!address) throw new Error.NoInstance()
    const instance = this.contracts[address]
    if (!instance) throw new Error.NoInstanceAtAddress(address)
    return instance
  }
  async execute (
    sender: Address,
    { address, codeHash }: Partial<Client>,
    msg:   Message,
    funds: unknown,
    memo?: unknown, 
    fee?:  unknown
  ) {
    const result = this.getInstance(address).execute({ sender, msg })
    const response = parseResult(result, 'execute', address)
    if (response.data !== null) response.data = b64toUtf8(response.data)
    await this.passCallbacks(address, response.messages)
    return response
  }
  async passCallbacks (sender: Address|undefined, messages: Array<any>) {
    if (!sender) {
      throw new Error("mocknet.passCallbacks: can't pass callbacks without sender")
    }
    for (const message of messages) {
      const { wasm } = message
      if (!wasm) {
        this.log.warn(
          'mocknet.execute: transaction returned non-wasm message, ignoring:',
          message
        )
        continue
      }
      const { instantiate, execute } = wasm
      if (instantiate) {
        const { code_id: codeId, callback_code_hash: codeHash, label, msg, send } = instantiate
        const instance = await this.instantiate(sender, new Contract({
          codeHash, codeId, label, initMsg: JSON.parse(b64toUtf8(msg)),
        }))
        this.log.debug(
          `Callback from ${bold(sender)}: instantiated contract`, bold(label),
          'from code id', bold(codeId), 'with hash', bold(codeHash),
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
        this.log.debug(
          `Callback from ${bold(sender)}: executed transaction`,
          'on contract', bold(contract_addr), 'with hash', bold(callback_code_hash),
        )
      } else {
        this.log.warn(
          'mocknet.execute: transaction returned wasm message that was not '+
          '"instantiate" or "execute", ignoring:',
          message
        )
      }
    }
  }
}

class MocknetAgent extends Agent {
  declare chain: Mocknet

  name: string = 'MocknetAgent'

  address: Address = randomBech32(MOCKNET_ADDRESS_PREFIX)

  /** Message bundle that warns about unsupported messages. */
  static Bundle: BundleClass<MocknetBundle>

  constructor (options: AgentOpts & { chain: Mocknet }) {
    super(options)
    this.chain = options.chain
    this.log.label = `${this.address} on Mocknet`
  }

  get defaultDenom (): string {
    return assertChain(this).defaultDenom
  }
  get account () {
    return Promise.resolve({})
  }

  async upload (blob: Uint8Array): Promise<Uploaded> {
    return new Contract(this.chain.upload(blob)) as unknown as Uploaded
  }
  async instantiate <C extends Client> (instance: Contract<C>) {
    instance.initMsg = await into(instance.initMsg)
    const result = await this.chain.instantiate(this.address, instance as unknown as AnyContract)
    return {
      chainId:  this.chain.id,
      address:  result.address!,
      codeHash: result.codeHash!,
      label:    result.label!,
      initBy:   this.address,
      initTx:   ''
    }
  }
  async execute <R> (
    instance: Partial<Client>,
    msg:      Message,
    opts:     ExecOpts = {}
  ): Promise<R> {
    return await this.chain.execute(this.address, instance, msg, opts.send, opts.memo, opts.fee)
  }
  async query <R> (instance: Client, msg: Message): Promise<R> {
    return await assertChain(this).query(instance, msg)
  }
  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any) {
    return Promise.resolve()
  }
  sendMany (_1:any, _2:any, _3?:any, _4?:any) {
    return Promise.resolve()
  }
}

class MocknetBundle extends Bundle {
  declare agent: MocknetAgent
  get log () {
    return this.agent.log.sub('(bundle)')
  }
  async submit (memo = "") {
    this.log.info('Submitting mocknet bundle...')
    const results = []
    for (const { init, exec } of this.msgs) {
      if (!!init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        results.push(await this.agent.instantiate(new Contract({
          codeId: String(codeId), initMsg: msg, codeHash, label,
        })))
      } else if (!!exec) {
        const { sender, contract: address, codeHash, msg, funds: send } = exec
        results.push(await this.agent.execute({ address, codeHash }, msg, { send }))
      } else {
        this.log.warn('MocknetBundle#submit: found unknown message in bundle, ignoring')
        results.push(null)
      }
    }
    return results
  }
  save (name: string): Promise<unknown> {
    throw new Error('MocknetBundle#save: not implemented')
  }
}

Object.assign(Mocknet, { Agent: Object.assign(MocknetAgent, { Bundle: MocknetBundle }) })

export {
  Mocknet       as Chain,
  MocknetAgent  as Agent,
  MocknetBundle as Bundle
}
