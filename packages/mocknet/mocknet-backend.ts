import { into, Contract } from '@fadroma/core'
import type { Address, Client, CodeId, CodeHash, Label, Message, AnyContract } from '@fadroma/core'
import { bech32, randomBech32, sha256, base16 } from '@hackbg/4mat'
import { bold } from '@hackbg/logs'
import type { MocknetContract } from './mocknet-contract'
import { parseResult, b64toUtf8, codeHashForBlob } from './mocknet-data'
import { MocknetConsole, MocknetError } from './mocknet-events'

import type { MocknetContract_CW0, MocknetContract_CW1 } from './mocknet-contract'
import type { ContractImports_CW0, ContractImports_CW1 } from './mocknet-imports'
import type { ContractExports_CW0, ContractExports_CW1 } from './mocknet-exports'
import { makeContext_CW0, makeContext_CW1 } from './mocknet-exports'

export abstract class MocknetBackend {

  log = new MocknetConsole('Fadroma.Mocknet')

  codeId = 0

  codeIdForCodeHash: Record<CodeHash, CodeId> = {}

  codeIdForAddress: Record<Address, CodeId> = {}

  labelForAddress: Record<Address, Label> = {}

  constructor (
    readonly chainId:   string,
    /** Map of code ID to WASM code blobs. */
    readonly uploads:   Record<CodeId, unknown>          = {},
    /** Map of addresses to WASM instances. */
    readonly instances: Record<Address, MocknetContract> = {},
  ) {
    if (Object.keys(uploads).length > 0) {
      this.codeId = (Math.max(...Object.keys(uploads).map(x=>Number(x))) ?? 0) + 1
    }
  }

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

  abstract context (...args: unknown[]): unknown[]

  async instantiate (
    sender:   Address,
    instance: AnyContract
  ): Promise<Partial<AnyContract>> {
    const label    = instance.label
    const initMsg  = await into(instance.initMsg)
    const chainId  = this.chainId
    const code     = this.getCode(instance.codeId!)
    const Contract = (this.constructor as any).Contract
    const contract = await new Contract(this).load(code, instance.codeId)
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
    const context  = this.context(sender, address)
    const result   = this.getInstance(address).execute(...context, msg)
    const response = parseResult(result, 'execute', address)
    if (response.data !== null) {
      response.data = b64toUtf8(response.data)
    }
    await this.passCallbacks(address, response.messages)
    return response
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
        const instance = await this.instantiate(sender, new Contract({
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

  abstract query ({ address, codeHash }: Partial<Client>, msg: Message): any

}

export class MocknetBackend_CW0 extends MocknetBackend {
  /** Contract host class for CW0. */
  static Contract: typeof MocknetContract_CW0

  context (
    sender:   Address,
    address?: Address,
    codeHash: CodeHash|undefined = address ? this.instances[address]?.codeHash : undefined,
    now:      number             = + new Date()
  ): [unknown] {
    return makeContext_CW0(this.chainId, sender, address, codeHash, now)
  }

  async query ({ address, codeHash }: Partial<Client>, msg: Message) {
    const result = b64toUtf8(parseResult(this.getInstance(address).query(msg), 'query', address))
    return JSON.parse(result)
  }
}

export class MocknetBackend_CW1 extends MocknetBackend {
  /** Contract host class for CW1. */
  static Contract: typeof MocknetContract_CW1

  context (
    sender:   Address,
    address?: Address,
    codeHash: CodeHash|undefined = address ? this.instances[address]?.codeHash : undefined,
    now:      number             = + new Date()
  ): [unknown, unknown] {
    return makeContext_CW1(this.chainId, sender, address, codeHash, now)
  }

  async query ({ address, codeHash }: Partial<Client>, msg: Message) {
    const [env] = this.context('', address, codeHash)
    const result = b64toUtf8(parseResult(this.getInstance(address).query(env, msg), 'query', address))
    return JSON.parse(result)
  }
}
