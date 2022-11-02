import { into, ContractInstance } from '@fadroma/client'
import type { Address, Client, CodeId, CodeHash, Label, Message } from '@fadroma/client'
import { bech32, randomBech32, sha256, base16 } from '@hackbg/formati'
import { bold } from '@hackbg/konzola'
import type { MocknetContract } from './mocknet-contract'
import { parseResult, b64toUtf8, codeHashForBlob } from './mocknet-data'
import { MocknetConsole, MocknetError } from './mocknet-events'

/** Hosts MocknetContract instances. */
export class MocknetBackend {
  /** Hosts an instance of a WASM code blob and its local storage. */
  static Contract: typeof MocknetContract

  log = new MocknetConsole('Fadroma.Mocknet')

  constructor (
    readonly chainId:   string,
    readonly uploads:   Record<CodeId, unknown>          = {},
    readonly instances: Record<Address, MocknetContract> = {},
  ) {
    if (Object.keys(uploads).length > 0) {
      this.codeId = (Math.max(...Object.keys(uploads).map(x=>Number(x))) ?? 0) + 1
    }
  }

  codeId = 0

  codeIdForCodeHash: Record<CodeHash, CodeId> = {}

  codeIdForAddress:  Record<Address,  CodeId> = {}

  labelForAddress:   Record<Address,  Label>  = {}

  getCode (codeId: CodeId) {
    const code = this.uploads[codeId]
    if (!code) throw new Error(`No code with id ${codeId}`)
    return code
  }

  upload (blob: Uint8Array) {
    const chainId  = this.chainId
    const codeId   = String(++this.codeId)
    const content  = this.uploads[codeId] = blob
    const codeHash = codeHashForBlob(blob)
    this.codeIdForCodeHash[codeHash] = String(codeId)
    return { codeId, codeHash }
  }

  getInstance (address?: Address) {
    if (!address) throw new MocknetError.NoInstance()
    const instance = this.instances[address]
    if (!instance) throw new MocknetError.NoInstanceAtAddress(address)
    return instance
  }

  async instantiate (
    sender:   Address,
    instance: ContractInstance
  ): Promise<Partial<ContractInstance>> {
    const label    = instance.label
    const initMsg  = await into(instance.initMsg)
    const chainId  = this.chainId
    const code     = this.getCode(instance.codeId!)
    const contract = await new MocknetBackend.Contract(this).load(code, instance.codeId)
    const context  = this.context(sender, contract.address, instance.codeHash)
    const response = contract.init(...context, initMsg!)
    const initResponse = parseResult(response, 'instantiate', contract.address)
    this.instances[contract.address]        = contract
    this.codeIdForAddress[contract.address] = instance.codeId!
    this.labelForAddress[contract.address]  = label!
    await this.passCallbacks(contract.address, initResponse.messages)
    return {
      address:  contract.address,
      chainId,
      codeId:   instance.codeId,
      codeHash: instance.codeHash,
      label
    }
  }

  async execute (
    sender: Address,
    { address, codeHash }: Partial<Client>,
    msg:   Message,
    funds: unknown,
    memo?: unknown, 
    fee?:  unknown
  ) {
    const result   = this.getInstance(address).execute(...this.context(sender, address), msg)
    const response = parseResult(result, 'execute', address)
    if (response.data !== null) {
      response.data = b64toUtf8(response.data)
    }
    await this.passCallbacks(address, response.messages)
    return response
  }

  /** Populate the `Env` and `Info` object available in transactions. */
  context (
    sender:   Address,
    address?: Address,
    codeHash: CodeHash|undefined = address ? this.instances[address]?.codeHash : undefined,
    now:      number             = + new Date()
  ): [unknown, unknown] {
    if (!address) throw new MocknetError.ContextNoAddress()
    const height   = Math.floor(now/5000)
    const time     = String(Math.floor(now/1000))
    const chain_id = this.chainId
    const sent_funds: any[] = []
    //const env  = {block:{height:0,time:"0"}}
    const env  = { block: { height, time, chain_id }, transaction: { index: 0 }, contract: { address } }
    const info = { sender, funds: [] }
    return [env, info]
  }

  async passCallbacks (sender: Address|undefined, messages: Array<any>) {
    if (!sender) {
      throw new Error("MocknetBackend#passCallbacks: can't pass callbacks without sender")
    }
    for (const message of messages) {
      const { wasm } = message
      if (!wasm) {
        this.log.warn(
          'MocknetBackend#execute: transaction returned non-wasm message, ignoring:',
          message
        )
        continue
      }
      const { instantiate, execute } = wasm
      if (instantiate) {
        const { code_id: codeId, callback_code_hash: codeHash, label, msg, send } = instantiate
        const instance = await this.instantiate(sender, new ContractInstance({
          codeHash, codeId, label, initMsg: JSON.parse(b64toUtf8(msg)),
        }))
        this.log.trace(
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
        this.log.trace(
          `Callback from ${bold(sender)}: executed transaction`,
          'on contract', bold(contract_addr), 'with hash', bold(callback_code_hash),
        )
      } else {
        this.log.warn(
          'MocknetBackend#execute: transaction returned wasm message that was not '+
          '"instantiate" or "execute", ignoring:',
          message
        )
      }
    }
  }

  async query ({ address, codeHash }: Partial<Client>, msg: Message) {
    const result = b64toUtf8(parseResult(this.getInstance(address).query(msg), 'query', address))
    return JSON.parse(result)
  }

}
