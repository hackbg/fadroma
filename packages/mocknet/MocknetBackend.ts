import Console from './MocknetConsole'
import Error from './MocknetError'
import { parseResult, b64toUtf8, codeHashForBlob } from './MocknetData'

import type MocknetContract from './MocknetContract'

import { into, Contract } from '@fadroma/core'
import type { Address, Client, CodeId, CodeHash, Label, Message, AnyContract } from '@fadroma/core'

import { bech32, randomBech32, sha256, base16 } from '@hackbg/4mat'
import { bold } from '@hackbg/logs'

export default abstract class MocknetBackend {

  log = new Console('Fadroma.Mocknet')

  codeId = 0

  codeIdForCodeHash: Record<CodeHash, CodeId> = {}

  codeIdForAddress: Record<Address, CodeId> = {}

  labelForAddress: Record<Address, Label> = {}

  constructor (
    readonly chainId:   string,
    /** Map of code ID to WASM code blobs. */
    readonly uploads:   Record<CodeId, unknown>          = {},
    /** Map of addresses to WASM instances. */
    readonly instances: Record<Address, MocknetContract<any, any>> = {},
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
    if (!address) throw new Error.NoInstance()
    const instance = this.instances[address]
    if (!instance) throw new Error.NoInstanceAtAddress(address)
    return instance
  }

  abstract context (...args: unknown[]): unknown[]

  async instantiate (
    sender:   Address,
    instance: AnyContract
  ): Promise<Partial<AnyContract>> {
    const label    = instance.label
    const initMsg  = await into(instance.initMsg)
    if (typeof initMsg === 'undefined') throw new Error('Tried to instantiate a contract with undefined initMsg')
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
